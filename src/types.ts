type Table = { name: string };

type TablePreview = Table & {
  where?: Record<string, number>[];
};

export type { Table, TablePreview };
