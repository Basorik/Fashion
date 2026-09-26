# Bella

A mobile wardrobe app. Photograph your clothes, keep them all in one place, and see how often you actually wear each piece.

Built with [Expo](https://expo.dev) (React Native + TypeScript) and Expo Router.

## What works today

- **Wardrobe grid**: every item you own, filterable by category.
- **Add an item**: take a photo or pick one from your library, crop it, then give it a name, category, and optional color and price.
- **Item page**: tap "I wore this today" to log a wear (tap again to undo). Shows times worn, last worn, cost per wear when a price is set, and the items it's most often worn with. Items can be deleted.
- **Outfits tab**: pick two or more items and save them as a named outfit, shown as a photo collage.
- **Outfit page**: tap "I wore this today" to log a wear for the whole outfit, which also adds a wear to each of its items (items already logged that day aren't counted twice). Shows times worn, last worn and the outfit's items.

Everything is stored on the device: items, outfits and wear history in SQLite (`expo-sqlite`), photos in the app's document folder (`expo-file-system`).

## Roadmap

- Edit items and outfits after saving them.
- A calendar or history view of what you wore.
- Background removal on item photos; adding items from a product link.
- Accounts and cloud sync.

## Running it

```bash
npm install
npx expo start
```

Scan the QR code with the Expo Go app on your phone (iOS or Android). The web target isn't set up yet, because `expo-sqlite` on web needs extra bundler and header configuration.

## Checks

```bash
npm run typecheck
npm run lint
```

## Project layout

```
src/app/            screens (Expo Router: each file is a route)
  (tabs)/           the Wardrobe and Outfits tabs
  add-item.tsx      add-item modal
  item/[id].tsx     item details and wear logging
  new-outfit.tsx    create-outfit modal
  outfit/[id].tsx   outfit details and wear logging
src/components/     shared UI
src/lib/db.ts       SQLite schema, migrations and queries
src/lib/photos.ts   saving and loading item photos
```
