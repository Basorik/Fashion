# Bella

A mobile wardrobe app. Photograph your clothes, keep them all in one place, and see how often you actually wear each piece.

Built with [Expo](https://expo.dev) (React Native + TypeScript) and Expo Router.

## What works today

- **Wardrobe grid**: every item you own, filterable by category.
- **Add an item** three ways: from a photo (camera or library), by scanning its barcode, or by hand with just a name. Photo, brand and price are optional.
- **Tags**: describe items by color, style, season, material and pattern, from presets or your own tags.
- **Barcode lookup**: scanning a UPC/EAN code looks the product up in [UPCitemdb](https://www.upcitemdb.com)'s free trial API (about 100 lookups a day, no key) and fills in the name, brand, color and product photo when it finds a match. Clothing coverage is patchy, so a miss just leaves the form for you to fill.
- **Photo tools, on the phone** (development build only, see below): a new photo has its background removed automatically, with a button to keep the original. Any photo can be cut out later from the edit screen. The app also labels what's in the photo and uses that to pick the category and suggest material, pattern, style and season tags. Cut-outs are shown whole in the wardrobe, outfits and on the outfit board. iOS uses Apple Vision (background removal needs iOS 17 or later); Android uses Google ML Kit. No photo leaves the phone.
- **Color tags from the photo** work everywhere, including Expo Go.
- **Import from a link**: paste a shop's product page link to fill in the name, brand, price and photo (read from the page's JSON-LD or Open Graph tags).
- **Edit** any item from its page.
- **Item page**: tap "I wore this today" to log a wear (tap again to undo). Shows times worn, last worn, cost per wear when a price is set, and the items it's most often worn with. Items can be deleted.
- **Outfits tab**: pick two or more items and save them as a named outfit, shown as a photo collage.
- **Outfit page**: tap "I wore this today" to log a wear for the whole outfit, which also adds a wear to each of its items (items already logged that day aren't counted twice). Shows times worn, last worn and the outfit's items.
- **Outfit board**: arrange an outfit's items on a board (drag to move, pinch to resize, tap to bring forward); the layout shows on the outfit page.
- **Calendar tab**: a month view of what you wore and what you've planned. Log or plan an outfit for any day, and mark a planned outfit as worn.
- **What to wear today**: the local forecast from [Open-Meteo](https://open-meteo.com) (free, no key) and your saved outfits ranked by season tags, a layer for cold or rain, and how long since you last wore them.
- **Stats tab**: item and outfit counts, wardrobe value, cost per wear, most and least worn, category and color breakdowns, spending by month added.
- **Wishlist**: save things you're thinking of buying (from a link or by hand), ranked by how many items you own each would go with, based on category, style, season and color. "I bought it" moves an entry into your wardrobe.
- **Packing lists**: create a trip with dates, add outfits or single items, and tick them off as you pack.

Everything is stored on the device: items, outfits and wear history in SQLite (`expo-sqlite`), photos in the app's document folder (`expo-file-system`).

## Roadmap

- Filter the wardrobe by tag.
- Edit outfits after saving them.
- Importing items from a screenshot or receipt.
- Accounts and cloud sync.

## Running it

```bash
npm install
npx expo start
```

Scan the QR code with the Expo Go app on your phone (iOS or Android). The web target isn't set up yet, because `expo-sqlite` on web needs extra bundler and header configuration.

### Development build (for the photo tools)

Background removal and photo labels are native code in `modules/bella-vision`, which Expo Go doesn't include. Everything else still runs in Expo Go, where those buttons simply don't appear. To try them, build the app once with [EAS](https://docs.expo.dev/develop/development-builds/create-a-build/):

```bash
npm install
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android   # or ios
```

Install the build on your phone from the link EAS gives you, then run `npx expo start` and open the project from the Bella app instead of Expo Go. JavaScript changes reload as usual; rebuild only when native code or native packages change. iOS builds need an Apple Developer account and your device registered with `npx eas-cli@latest device:create`.

## Checks

```bash
npm run typecheck
npm run lint
```

## Project layout

```
src/app/            screens (Expo Router: each file is a route)
  (tabs)/           Wardrobe, Outfits, Calendar, Stats and Lists tabs
  add-item.tsx      add-item modal
  item/[id].tsx     item details and wear logging
  new-outfit.tsx    create-outfit modal
  outfit/[id].tsx   outfit details and wear logging
  outfit-board.tsx  drag-and-drop outfit board
  wish/[id].tsx     wishlist entry with matching items
  trip/[id].tsx     packing list
src/components/     shared UI
src/lib/db.ts       SQLite schema, migrations, item and outfit queries
src/lib/*.ts        calendar, stats, wishlist, trips, board, weather, suggestions,
                    barcode and link import
src/lib/photos.ts   saving and loading item photos
src/lib/photo-ai.ts background removal and photo labels, turned into tags
modules/bella-vision/  native module: Apple Vision (iOS) and ML Kit (Android)
```
