import { strFromU8, strToU8 } from 'fflate';

import { toDateString } from '@/lib/dates';
import { decodeEntities } from '@/lib/link-import';
import { parsePrice } from '@/lib/money';

// Reads the items bought from an order confirmation email: pasted text (as
// copied from a mail app), the email's HTML, or a saved .eml file. Everything
// runs on the phone; nothing is sent anywhere.
//
// Shops lay these emails out in many ways, so rather than one template per
// shop this reads the email as lines and looks for the shape every one of them
// shares: a product name, followed closely by item facts (color, size,
// quantity, article number) or a price. Photos and product links come from
// the HTML, where there is one.

export type OrderItem = {
  name: string;
  color: string | null;
  size: string | null;
  quantity: number;
  price: number | null;
  // The product photo shown in the email, and the link on the product's name.
  image: string | null;
  link: string | null;
  // Other labelled facts, like "Fit: Relaxed", for tag inference.
  details: string[];
};

export type Order = {
  // The shop the email came from, when it's one we know.
  shop: string | null;
  // The shop's own brand, for shops that sell only their own clothes.
  brand: string | null;
  orderedOn: string | null;
  items: OrderItem[];
};

type Line = { text: string; images: string[]; link: string | null };

// Letters in Latin, Greek, Cyrillic, Japanese, Chinese and Korean scripts.
const LETTER =
  'A-Za-z\\u00C0-\\u024F\\u0370-\\u03FF\\u0400-\\u04FF\\u3040-\\u30FF\\u4E00-\\u9FFF\\uAC00-\\uD7AF';
const TWO_LETTERS = new RegExp(`[${LETTER}]{2}`);
const NOT_LETTERS = new RegExp(`[^${LETTER}]`, 'g');

export function parseOrderEmail(input: string): Order {
  const email = readEmail(input);
  const lines = email.html ? htmlLines(email.html) : textLines(email.text);
  const shop = findShop([email.from, email.subject, email.html ?? email.text].join('\n'));
  const items = findItems(lines, shop);
  const body = lines.map((line) => line.text);
  return {
    shop: shop?.name ?? null,
    brand: shop?.brand ?? null,
    orderedOn: orderDate(body, email.date),
    items,
  };
}

// ---------------------------------------------------------------------------
// Email files

type Email = { from: string; subject: string; date: string; html: string | null; text: string };

type Part = { headers: Record<string, string>; body: string };

function splitHeaders(raw: string): Part {
  const end = raw.search(/\r?\n\r?\n/);
  const head = end === -1 ? raw : raw.slice(0, end);
  const body = end === -1 ? '' : raw.slice(end).replace(/^\r?\n\r?\n/, '');
  const headers: Record<string, string> = {};
  // Long header values continue on lines that start with whitespace.
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const match = line.match(/^([\w-]+):\s*(.*)$/);
    if (match) headers[match[1].toLowerCase()] = match[2];
  }
  return { headers, body };
}

// A saved .eml starts with mail headers; pasted text doesn't.
function isEmailFile(input: string) {
  const head = input.slice(0, 4000);
  return (
    /^(received|return-path|from|delivered-to|mime-version|x-[\w-]+|date|message-id|to|subject|content-type):/im.test(
      head.split(/\r?\n/)[0] ?? '',
    ) && /^content-type:/im.test(head)
  );
}

function decodeBytes(bytes: Uint8Array, charset: string) {
  return /utf-?8/i.test(charset) || !charset ? strFromU8(bytes) : strFromU8(bytes, true);
}

function base64Bytes(text: string) {
  const binary = atob(text.replace(/[^A-Za-z0-9+/=]/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function quotedPrintableBytes(text: string) {
  const joined = text.replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  for (let index = 0; index < joined.length; index++) {
    const hex = joined.slice(index + 1, index + 3);
    if (joined[index] === '=' && /^[0-9a-f]{2}$/i.test(hex)) {
      bytes.push(parseInt(hex, 16));
      index += 2;
    } else {
      // Anything outside ASCII is already text, so keep it as UTF-8.
      const code = joined.charCodeAt(index);
      if (code < 128) bytes.push(code);
      else bytes.push(...strToU8(joined[index]));
    }
  }
  return new Uint8Array(bytes);
}

function decodeBody(body: string, encoding: string, charset: string) {
  try {
    if (/base64/i.test(encoding)) return decodeBytes(base64Bytes(body), charset);
    if (/quoted-printable/i.test(encoding)) return decodeBytes(quotedPrintableBytes(body), charset);
  } catch {
    // A damaged part is read as it is.
  }
  return body;
}

// Header words like =?UTF-8?Q?Your_order?= or =?utf-8?B?...?=.
function decodeHeader(value = '') {
  return value.replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (whole, charset, kind, text) => {
    try {
      const bytes =
        kind.toLowerCase() === 'b'
          ? base64Bytes(text)
          : quotedPrintableBytes(text.replace(/_/g, ' '));
      return decodeBytes(bytes, charset);
    } catch {
      return whole;
    }
  });
}

function parameter(header = '', name: string) {
  return header.match(new RegExp(`${name}\\s*=\\s*"?([^";]+)"?`, 'i'))?.[1] ?? '';
}

// Collects the text/html and text/plain parts of a (possibly nested) multipart message.
function collectParts(part: Part, found: { html: string[]; text: string[] }, depth = 0) {
  const type = part.headers['content-type'] ?? 'text/plain';
  if (/^multipart\//i.test(type) && depth < 8) {
    const boundary = parameter(type, 'boundary');
    if (!boundary) return;
    const escaped = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pieces = part.body.split(new RegExp(`\\r?\\n?--${escaped}(?:--)?[ \\t]*\\r?\\n?`));
    for (const piece of pieces.slice(1)) {
      if (piece.trim()) collectParts(splitHeaders(piece), found, depth + 1);
    }
    return;
  }
  if (/attachment/i.test(part.headers['content-disposition'] ?? '')) return;
  const decoded = decodeBody(
    part.body,
    part.headers['content-transfer-encoding'] ?? '',
    parameter(type, 'charset'),
  );
  if (/^text\/html/i.test(type)) found.html.push(decoded);
  else if (/^text\/plain/i.test(type)) found.text.push(decoded);
}

function readEmail(input: string): Email {
  if (!isEmailFile(input)) {
    const html = /<(html|body|table|div|td|p|br)\b/i.test(input) ? input : null;
    return { from: '', subject: '', date: '', html, text: input };
  }
  const message = splitHeaders(input);
  const found = { html: [] as string[], text: [] as string[] };
  collectParts(message, found);
  return {
    from: decodeHeader(message.headers.from),
    subject: decodeHeader(message.headers.subject),
    date: message.headers.date ?? '',
    html: found.html.length > 0 ? found.html.join('\n') : null,
    text: found.text.join('\n'),
  };
}

// ---------------------------------------------------------------------------
// Turning the email into lines

function cleanText(text: string) {
  return text
    .replace(/[​-‍⁠﻿͏­]/g, '')
    .replace(/[ \t   ]+/g, ' ')
    .trim();
}

function textLines(text: string): Line[] {
  return (
    text
      .split(/\r?\n/)
      // Quoted replies and forwards start lines with "> ".
      .map((line) => cleanText(line.replace(/^(>\s?)+/, '')))
      .filter(Boolean)
      .map((line) => ({ text: line, images: [], link: null }))
  );
}

function attribute(tag: string, name: string) {
  const value = tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'))?.[2];
  return value ? decodeEntities(value) : null;
}

// Logos, icons, spacers, tracking pixels, social buttons and banners.
const NOT_A_PRODUCT_PHOTO =
  /\.(svg|gif)(\?|$)|logo|icon|spacer|pixel|track|beacon|open\?|facebook|instagram|twitter|pinterest|youtube|tiktok|snapchat|app-?store|google-?play|badge|banner|header|footer|social|arrow|divider|blank|1x1|rating|star|payment|klarna|paypal|visa|mastercard/i;

function productImage(tag: string) {
  const src = attribute(tag, 'src') ?? attribute(tag, 'data-src');
  if (!src || !/^https?:\/\//i.test(src) || NOT_A_PRODUCT_PHOTO.test(src)) return null;
  const size = (name: string) => {
    const value =
      attribute(tag, name) ?? tag.match(new RegExp(`${name}\\s*:\\s*(\\d+)px`, 'i'))?.[1];
    return value ? parseInt(value, 10) : null;
  };
  const width = size('width');
  const height = size('height');
  if ((width !== null && width < 48) || (height !== null && height < 48)) return null;
  return src.replace(/^http:/i, 'https:');
}

function usefulLink(href: string | null) {
  if (!href || !/^https?:\/\//i.test(href)) return null;
  return /unsubscribe|privacy|preferences|mailto:|help|support|contact|account/i.test(href)
    ? null
    : href;
}

// Tags that start a new line of text when an email is read as lines. Table
// cells count, so a row of "photo | name | qty | price" becomes one line each.
const BLOCK =
  /^\/?(br|p|div|li|ul|ol|tr|td|th|table|tbody|thead|h[1-6]|section|article|header|footer|center|blockquote|hr|dl|dt|dd)$/i;

function htmlLines(html: string): Line[] {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(head|style|script|title|noscript)\b[\s\S]*?<\/\1>/gi, ' ');
  const lines: Line[] = [];
  let text = '';
  let images: string[] = [];
  let link: string | null = null;
  let lineLink: string | null = null;

  function flush() {
    const value = cleanText(decodeEntities(text));
    if (value || images.length > 0)
      lines.push({ text: value, images, link: value ? lineLink : null });
    text = '';
    images = [];
    lineLink = null;
  }

  for (const piece of cleaned.split(/(<[^>]*>)/)) {
    if (!piece.startsWith('<')) {
      text += piece.replace(/\s+/g, ' ');
      if (link && piece.trim()) lineLink = lineLink ?? link;
      continue;
    }
    const name = piece.match(/^<\s*(\/?[a-z0-9]+)/i)?.[1] ?? '';
    if (/^img$/i.test(name)) {
      const image = productImage(piece);
      if (image) {
        flush();
        images.push(image);
        flush();
      }
    } else if (/^a$/i.test(name)) {
      link = usefulLink(attribute(piece, 'href'));
    } else if (/^\/a$/i.test(name)) {
      link = null;
    } else if (BLOCK.test(name)) {
      flush();
    }
  }
  flush();
  return lines;
}

// ---------------------------------------------------------------------------
// Shops

type Shop = { name: string; brand: string | null; pattern: RegExp };

// Shops whose emails are common. `brand` is set for shops that sell only their
// own clothes; marketplaces leave the brand to the item.
const SHOPS: Shop[] = [
  { name: 'Uniqlo', brand: 'Uniqlo', pattern: /uniqlo/i },
  { name: 'Zara', brand: 'Zara', pattern: /\bzara\b/i },
  { name: 'H&M', brand: 'H&M', pattern: /\bh&(amp;)?m\b|\bhm\.com\b/i },
  { name: 'ASOS', brand: null, pattern: /\basos\b/i },
  { name: 'Amazon', brand: null, pattern: /\bamazon\.|\bamazon\b/i },
  { name: 'Zalando', brand: null, pattern: /\bzalando\b/i },
  { name: 'Nordstrom', brand: null, pattern: /\bnordstrom\b/i },
  { name: 'Shein', brand: 'Shein', pattern: /\bshein\b/i },
  { name: 'Mango', brand: 'Mango', pattern: /\bmango\.com\b|\bmango\b(?= (online|order|shop))/i },
  { name: 'COS', brand: 'COS', pattern: /\bcos(stores)?\.com\b/i },
  { name: 'Arket', brand: 'Arket', pattern: /\barket\b/i },
  { name: 'Massimo Dutti', brand: 'Massimo Dutti', pattern: /massimo ?dutti/i },
  { name: 'Pull&Bear', brand: 'Pull&Bear', pattern: /pull ?(&|and|&amp;) ?bear/i },
  { name: 'Bershka', brand: 'Bershka', pattern: /\bbershka\b/i },
  { name: 'Gap', brand: 'Gap', pattern: /\bgap\.com\b|\bgap inc\b/i },
  { name: 'Old Navy', brand: 'Old Navy', pattern: /\bold ?navy\b/i },
  { name: 'Levi’s', brand: 'Levi’s', pattern: /\blevi\.com\b|\blevi strauss\b/i },
  { name: 'Nike', brand: 'Nike', pattern: /\bnike\.com\b/i },
  { name: 'Adidas', brand: 'Adidas', pattern: /\badidas\.\w+\b/i },
  { name: 'Lululemon', brand: 'Lululemon', pattern: /\blululemon\b/i },
  { name: 'Everlane', brand: 'Everlane', pattern: /\beverlane\b/i },
  { name: 'J.Crew', brand: 'J.Crew', pattern: /\bj\.? ?crew\b/i },
  { name: 'Madewell', brand: 'Madewell', pattern: /\bmadewell\b/i },
  { name: 'Aritzia', brand: 'Aritzia', pattern: /\baritzia\b/i },
  { name: 'Abercrombie & Fitch', brand: 'Abercrombie & Fitch', pattern: /\babercrombie\b/i },
  { name: 'Next', brand: null, pattern: /\bnext\.co\.uk\b/i },
  {
    name: 'Marks & Spencer',
    brand: 'M&S',
    pattern: /marks ?(&|and|&amp;) ?spencer|\bmarksandspencer\b/i,
  },
  { name: 'John Lewis', brand: null, pattern: /\bjohn ?lewis\b/i },
  { name: 'Target', brand: null, pattern: /\btarget\.com\b/i },
  { name: 'Walmart', brand: null, pattern: /\bwalmart\b/i },
];

function findShop(text: string) {
  return SHOPS.find((shop) => shop.pattern.test(text)) ?? null;
}

// ---------------------------------------------------------------------------
// Finding the items

const CURRENCY =
  '(?:US\\$|CA\\$|C\\$|A\\$|AU\\$|NZ\\$|HK\\$|S\\$|R\\$|[$£€¥₹]|kr\\.?|zł|CHF|USD|EUR|GBP|CAD|AUD|SEK|NOK|DKK|PLN|JPY|INR)';
const AMOUNT = '\\d{1,3}(?:[.,\\s]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?';
// A currency after the amount mustn't be the start of the next price ("1 €59,00").
const PRICE = new RegExp(`${CURRENCY}\\s?(${AMOUNT})|(${AMOUNT})\\s?${CURRENCY}(?!\\s?\\d)`, 'gi');

function prices(text: string) {
  return [...text.matchAll(PRICE)]
    .map((match) => parsePrice(match[1] ?? match[2]))
    .filter((value): value is number => value !== null && value > 0);
}

// A line that is only a price, maybe with words like "Price", "each" or "was".
function isPriceLine(text: string) {
  if (prices(text).length === 0) return false;
  const rest = text
    .replace(PRICE, ' ')
    .replace(
      /\b(price|each|per item|unit|sale|now|was|orig(inal)?|reg(ular)?|incl\.?|vat|tax)\b/gi,
      ' ',
    )
    .replace(/[^a-z]/gi, '');
  return rest.length <= 2;
}

// Lines about the order rather than an item: greetings, delivery, totals, footers.
const BOILERPLATE =
  /^(hi|hello|hey|dear)\b(?!-)|\b(thanks?|thank you|order(ed|s)?|your|we|we'll|we’ll|ship(ped|ping|ment)|deliver(y|ed|ing|ies)|dispatch(ed)?|arriv(e|es|ing|al)|tracking|track (your|my|order|package|parcel)|returns?|refund|exchange|view|manage|account|sign in|log in|download|follow us|unsubscribe|privacy|terms|policy|customer (service|care)|help|faq|questions?|contact|copyright|rights reserved|confirm(ed|ation)?|receipt|invoice|payment|paid|billing|address|items|summary|status|estimated|expected|pick ?up|in store|points|member(ship)?|rewards?|save|saved|savings|discount|promo|coupon|voucher|gift card|shop now|see (more|all)|click|email|subtotal|total|tax|vat|postage|carrier|recipient|buy again|write a review|cancel(led)?)\b|©/i;

// The start of the totals and addresses after the items.
const END_OF_ITEMS =
  /^(sub-?total|order total|grand total|total (paid|charged|amount|before|incl|excl|to pay)|amount (paid|charged)|payment (method|details|summary|information)|billing (address|details)|shipping (address|details)|delivery (address|details)|order summary|price summary|summary of charges|your total)\b/i;

// Money lines that belong to the order, not an item ("Shipping $5", "Total: $24.99").
const SUMMARY_LINE =
  /^(total|sub-?total|(standard |express |next[- ]day |free )?(shipping|delivery|postage)|tax|sales tax|estimated tax|vat|discount|savings|you saved|promo|coupon|gift card|store credit|refund)\b/i;

// Labels shops put in front of item facts. Quantity and code labels may be
// followed straight by the value ("Qty 1", "Ref. 1234/567"); the rest need a colon.
const LABEL =
  /(?:^|[\s|,;•·/])(colou?rway|colou?r|shade|size|qty|quantity|quant\.?|units?|art(?:icle)?\.?\s*(?:no|nr|number)\.?|ref(?:erence)?\.?|item\s*(?:no\.?|#|number|code)|sku|style\s*(?:no\.?|#|number|code)|product\s+(?:code|number)|model|unit\s+price|item\s+price|price|each|fit|width|length|inseam|material|fabric)\s*(?:[:#]\s*|(?=\s*\d))/gi;

type Fact = { label: string; value: string };

// Splits "Color: Black Size: M Qty: 1" into its facts, and returns the text before the first label.
function readFacts(text: string): { before: string; facts: Fact[] } {
  const matches = [...text.matchAll(LABEL)];
  if (matches.length === 0) return { before: text, facts: [] };
  const facts = matches.map((match, index) => {
    const start = match.index! + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    return {
      label: match[1].toLowerCase().replace(/\s+/g, ' '),
      value: text.slice(start, end).replace(/^[\s|,;•·/:-]+|[\s|,;•·/:-]+$/g, ''),
    };
  });
  return { before: text.slice(0, matches[0].index).replace(/[\s|,;•·/:-]+$/, ''), facts };
}

const SIZE_WORD =
  /^((size\s+)?(xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|[2-6]xl|x-small|small|medium|large|x-large|xx-large|extra small|extra large|one size|os)|(eu|uk|us|fr|it|w)?\s?\d{1,2}([.,]5)?|\d{2}\s?[wx/]\s?\d{2}l?|\d{2}w\s?x\s?\d{2}l|w\s?\d{2}\s?l\s?\d{2}|\d{2,3}\s?cm|(petite|tall|plus)\s+\S+)$/i;

// "Black / M", "M / Black" or "Navy / 32 / Regular", as Shopify and many
// others write the chosen variant. Returns null when no part is a size.
function readVariant(text: string): { color: string | null; size: string } | null {
  const parts = text.split(/\s+[/|]\s+|\s+-\s+/).map((part) => part.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => part.length > 30)) return null;
  const sizeIndex = parts.findIndex((part) => SIZE_WORD.test(part));
  if (sizeIndex === -1) return null;
  const others = parts.filter((_, index) => index !== sizeIndex);
  if (others.some((part) => !/^[a-z][a-z .'-]*$/i.test(part))) return null;
  return { size: parts[sizeIndex], color: others[0] ?? null };
}

const MONTH_WORD =
  '(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sept?(ember)?|oct(ober)?|nov(ember)?|dec(ember)?)';
const DATE_WORDS = new RegExp(
  `\\b${MONTH_WORD}\\.?\\s+\\d{1,2}\\b|\\b\\d{1,2}\\s+${MONTH_WORD}\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2}[/.]\\d{1,2}[/.]\\d{2,4}\\b`,
  'i',
);

// Could this line be an item's name?
function isNameLike(text: string, shop: Shop | null) {
  if (text.length < 3 || text.length > 150) return false;
  if (!TWO_LETTERS.test(text)) return false;
  if (/https?:|www\.|@/i.test(text)) return false;
  if (/^[^:]{1,40}:(\s|$)/.test(text)) return false;
  if (text.split(/\s+/).length > 20) return false;
  if (BOILERPLATE.test(text) || DATE_WORDS.test(text)) return false;
  if (/^(#|no\.?\s*)?\d[\d\s-]*$/i.test(text)) return false;
  if (shop && shop.pattern.test(text) && text.length <= shop.name.length + 12) return false;
  if (findShop(text) && text.split(/\s+/).length <= 2) return false;
  return true;
}

// Removes a leading color code, like Uniqlo's "09 BLACK" or Zara's "800-White".
function cleanColor(value: string) {
  const color = value.replace(/^(col(ou?r)?\.?\s*)?\d{1,3}\s*[-:]?\s*(?=[a-z])/i, '').trim();
  return color ? tidyCase(color) : null;
}

function cleanSize(value: string) {
  const size = value.replace(/^(size\s+)?/i, '').trim();
  return size || null;
}

// ALL CAPS names read as shouting in the wardrobe, so "LINEN BLEND SHIRT" becomes "Linen blend shirt".
function tidyCase(text: string) {
  const letters = text.replace(NOT_LETTERS, '');
  if (letters.length < 4 || letters !== letters.toUpperCase()) return text;
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

type Draft = OrderItem & { prices: number[] };

// Reads "2 x Linen shirt", "Linen shirt × 2" or "Linen shirt Qty 2" from a name line.
function nameAndQuantity(text: string) {
  let name = text;
  let quantity: number | null = null;
  const leading = name.match(/^(\d{1,2})\s*[x×]\s+/i);
  if (leading) {
    quantity = Number(leading[1]);
    name = name.slice(leading[0].length);
  }
  const trailing = name.match(/\s+[x×]\s*(\d{1,2})$/i);
  if (trailing) {
    quantity = Number(trailing[1]);
    name = name.slice(0, trailing.index);
  }
  return { name: name.replace(/[\s|,;•·:-]+$/, '').trim(), quantity };
}

function findItems(lines: Line[], shop: Shop | null): OrderItem[] {
  const items: Draft[] = [];
  let current: Draft | null = null;
  // Name-like lines seen since the last item fact, newest last.
  let names: Line[] = [];
  let image: string | null = null;

  function start(nameLine: Line, text = nameLine.text) {
    const { name, quantity } = nameAndQuantity(text);
    current = {
      name: tidyCase(name),
      color: null,
      size: null,
      quantity: quantity ?? 1,
      price: null,
      image,
      link: nameLine.link,
      details: [],
      prices: [],
    };
    items.push(current);
    names = [];
    image = null;
    return current;
  }

  // The item a fact belongs to: the open one, or a new one named by the most
  // recent name-like line (a linked one first, since shops link item names).
  function itemForFact(): Draft | null {
    if (names.length > 0) {
      const linked = [...names].reverse().find((line) => line.link);
      return start(linked ?? names[names.length - 1]);
    }
    return current;
  }

  function applyFacts(item: Draft, facts: Fact[]) {
    for (const { label, value } of facts) {
      if (!value) continue;
      if (/^colou?r|shade/.test(label)) item.color = cleanColor(value) ?? item.color;
      else if (label === 'size') {
        // "Size: M / Colour: Black" was split already; "Size: Black / M" wasn't.
        const variant = readVariant(value);
        item.size = cleanSize(variant?.size ?? value) ?? item.size;
        if (variant?.color && !item.color) item.color = cleanColor(variant.color);
      } else if (/^(qty|quantity|quant|units?)/.test(label)) {
        const quantity = parseInt(value, 10);
        if (quantity > 0 && quantity < 100) item.quantity = quantity;
        // "Qty 1 €59,00" puts the price after the quantity.
        item.prices.push(...prices(value));
      } else if (/price|each/.test(label)) {
        item.prices.push(...prices(value));
      } else if (/^(fit|width|length|inseam|material|fabric)/.test(label)) {
        item.details.push(`${label.charAt(0).toUpperCase()}${label.slice(1)}: ${value}`);
      }
    }
  }

  for (const line of lines) {
    if (line.images.length > 0 && !line.text) {
      // A product photo starts the next item's block.
      current = null;
      names = [];
      image = line.images[line.images.length - 1];
      continue;
    }
    const text = line.text;

    if (END_OF_ITEMS.test(text)) {
      if (items.length > 0) break;
      names = [];
      image = null;
      continue;
    }
    if (SUMMARY_LINE.test(text)) {
      current = null;
      names = [];
      continue;
    }
    if (/^(sold|shipped|dispatched|fulfilled|supplied) by\b/i.test(text)) {
      if (names.length > 0) itemForFact();
      continue;
    }

    // "1 unit", "2 items" (a quantity cell on its own).
    const units = text.match(/^(\d{1,2})\s*(units?|pcs?|pieces?)$/i);
    if (units) {
      const item = itemForFact();
      if (item) item.quantity = Number(units[1]);
      continue;
    }

    if (isPriceLine(text)) {
      const item = itemForFact();
      item?.prices.push(...prices(text));
      continue;
    }

    const { before, facts } = readFacts(text);
    if (facts.length > 0) {
      // "Linen shirt Size: M" names the item and gives a fact on one line.
      const item =
        before && isNameLike(before, shop) && !readVariant(before)
          ? start(line, before)
          : itemForFact();
      if (item) applyFacts(item, facts);
      continue;
    }

    // A size on its own line, like "EU 42" or "One size".
    if (/[a-z]/i.test(text) && SIZE_WORD.test(text) && (names.length > 0 || current)) {
      const item = itemForFact()!;
      item.size = item.size ?? cleanSize(text);
      continue;
    }

    const variant = readVariant(text);
    if (variant && (names.length > 0 || current)) {
      const item = itemForFact()!;
      item.size = item.size ?? cleanSize(variant.size);
      item.color = item.color ?? (variant.color ? cleanColor(variant.color) : null);
      continue;
    }

    // "Linen shirt   1   $39.90": a name with its price on the same line.
    const trailingPrice = text.match(
      new RegExp(
        `^(.*?[${LETTER}].*?)\\s+(?:(\\d{1,2})\\s+)?((?:${CURRENCY}\\s?(?:${AMOUNT})|(?:${AMOUNT})\\s?${CURRENCY})(?:\\s+.*)?)$`,
        'i',
      ),
    );
    if (trailingPrice && isNameLike(trailingPrice[1], shop) && isPriceLine(trailingPrice[3])) {
      const item = start(line, trailingPrice[1]);
      if (trailingPrice[2]) item.quantity = Number(trailingPrice[2]);
      item.prices.push(...prices(trailingPrice[3]));
      continue;
    }

    if (isNameLike(text, shop)) {
      current = null;
      names = [...names, line].slice(-3);
      continue;
    }

    // Anything else (a greeting, an address, a bare number) ends a run of names,
    // unless it's a short bare number, like a quantity or size cell.
    if (!/^\d{1,3}$/.test(text)) names = [];
  }

  return dedupe(
    items.map(({ prices: found, ...item }) => ({
      ...withCommaVariant(item),
      // The lowest of several prices is the sale price or the price of one,
      // rather than the original price or the line total.
      price: found.length > 0 ? Math.min(...found) : null,
    })),
  );
}

// Amazon and other marketplaces end names with the chosen variant, like
// "Levi's Men's 505 Regular Fit Jeans, Dark Stonewash, 34W x 32L".
function withCommaVariant<T extends OrderItem>(item: T): T {
  const parts = item.name.split(/,\s+/);
  if (parts.length < 2 || item.size || !SIZE_WORD.test(parts[parts.length - 1])) return item;
  const size = parts.pop()!;
  const colorPart = parts.length >= 2 && parts[parts.length - 1].split(/\s+/).length <= 3;
  const color = colorPart ? parts.pop()! : null;
  return { ...item, name: parts.join(', '), size, color: item.color ?? color };
}

// Some emails list the items twice (a summary at the top, the order below).
function dedupe(items: OrderItem[]) {
  const byKey = new Map<string, OrderItem>();
  for (const item of items) {
    const key = [item.name, item.color, item.size].map((part) => part?.toLowerCase()).join('|');
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }
    existing.image = existing.image ?? item.image;
    existing.link = existing.link ?? item.link;
    existing.price = existing.price ?? item.price;
  }
  return [...byKey.values()];
}

// ---------------------------------------------------------------------------
// The order date

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function monthNumber(word: string) {
  return MONTHS.indexOf(word.slice(0, 3).toLowerCase()) + 1;
}

// A written date like "26 September 2026", "Sep 26, 2026" or "2026-09-26".
// Numeric dates like 09/10/2026 are skipped, since day and month order differ by country.
export function readDate(text: string): string | null {
  let year = 0;
  let month = 0;
  let day = 0;
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const dayFirst = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\.?\s+([a-z]{3,9})\.?,?\s+(\d{4})\b/i);
  const monthFirst = text.match(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i);
  if (iso) [year, month, day] = iso.slice(1).map(Number);
  else if (dayFirst && monthNumber(dayFirst[2]) > 0) {
    [day, month, year] = [Number(dayFirst[1]), monthNumber(dayFirst[2]), Number(dayFirst[3])];
  } else if (monthFirst && monthNumber(monthFirst[1]) > 0) {
    [month, day, year] = [monthNumber(monthFirst[1]), Number(monthFirst[2]), Number(monthFirst[3])];
  } else return null;
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  const result = toDateString(date);
  return result <= toDateString(new Date()) ? result : null;
}

function orderDate(lines: string[], header: string) {
  // "Order date: 20 Sep 2026", "Ordered on September 20, 2026", "Order placed" and the next line.
  for (let index = 0; index < lines.length; index++) {
    if (
      !/\b(order(ed)?|purchased?)\b.{0,30}\b(date|placed|on|made)\b|^date( of (order|purchase))?\s*:/i.test(
        lines[index],
      )
    )
      continue;
    const date = readDate(lines[index]) ?? readDate(lines[index + 1] ?? '');
    if (date) return date;
  }
  // The email's own date, or a forwarded email's "Date:" line.
  return readDate(header) ?? readDate(lines.find((line) => /^(date|sent):/i.test(line)) ?? '');
}
