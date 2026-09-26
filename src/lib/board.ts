import type { SQLiteDatabase } from 'expo-sqlite';

import type { Item } from '@/lib/db';

// x and y are the item's center as fractions (0-1) of the board's width and
// height; scale multiplies the default tile size. Later entries draw on top.
export type BoardPiece = Pick<Item, 'id' | 'name' | 'photo'> & {
  x: number;
  y: number;
  scale: number;
};

type Row = Pick<Item, 'id' | 'name' | 'photo'> & {
  x: number | null;
  y: number | null;
  scale: number | null;
};

// Items without a saved position are laid out in a loose grid.
function defaultPosition(index: number, count: number) {
  const columns = count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / columns);
  return {
    x: ((index % columns) + 0.5) / columns,
    y: (Math.floor(index / columns) + 0.5) / rows,
    scale: 1,
  };
}

export async function getBoard(db: SQLiteDatabase, outfitId: number) {
  const rows = await db.getAllAsync<Row>(
    `SELECT items.id, items.name, items.photo, outfit_items.x, outfit_items.y, outfit_items.scale
     FROM outfit_items JOIN items ON items.id = outfit_items.item_id
     WHERE outfit_items.outfit_id = ?
     ORDER BY outfit_items.position`,
    outfitId,
  );
  const arranged = rows.some((row) => row.x !== null);
  const pieces: BoardPiece[] = rows.map((row, index) =>
    row.x !== null && row.y !== null
      ? { ...row, x: row.x, y: row.y, scale: row.scale ?? 1 }
      : { ...row, ...defaultPosition(index, rows.length) },
  );
  return { pieces, arranged };
}

export async function saveBoard(db: SQLiteDatabase, outfitId: number, pieces: BoardPiece[]) {
  await db.withTransactionAsync(async () => {
    for (const [position, piece] of pieces.entries()) {
      await db.runAsync(
        'UPDATE outfit_items SET x = ?, y = ?, scale = ?, position = ? WHERE outfit_id = ? AND item_id = ?',
        piece.x,
        piece.y,
        piece.scale,
        position,
        outfitId,
        piece.id,
      );
    }
  });
}
