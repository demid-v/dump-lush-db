import { PrismaClient } from "@prisma/client";
import { Table, TablePreview } from "./types";

const prisma = new PrismaClient({
  log: ["query", "error", "warn"],
});

async function fetchTables() {
  const tables: Table[] = await prisma.$queryRaw`
    SELECT table_name as name
    FROM information_schema.tables
    WHERE table_schema = 'lush'
  `;

  return tables;
}

async function fetchPreview() {
  const tables: Table[] = await fetchTables();

  const artistIds = await prisma.artist.findMany({
    select: { id: true },
    where: {
      id: { gt: 4436 },
      deleted: false,
    },
    take: 102,
  });

  const albumIds: Set<number> = new Set();
  const albumPromises = [];

  for (const { id } of artistIds) {
    const albumId = prisma.album.findMany({
      select: { id: true },
      where: {
        track_album_rel: {
          some: {
            track: {
              track_artist_rel: {
                some: { artist_id: { equals: id } },
              },
            },
          },
        },
        deleted: false,
      },
      orderBy: [
        { album_format_id: "asc" },
        { release_year: "desc" },
        { release_month: "desc" },
        { release_day: "desc" },
      ],
      take: 6,
    });

    albumPromises.push(albumId);

    if (albumPromises.length >= 9) {
      const albumPromisesResolved = await Promise.all(albumPromises);

      for (const albumIdsResolved of albumPromisesResolved) {
        for (const { id } of albumIdsResolved) {
          albumIds.add(id);
        }
      }

      albumPromises.length = 0;
    }
  }

  const albumPromisesResolved = await Promise.all(albumPromises);

  for (const albumIdsResolved of albumPromisesResolved) {
    for (const { id } of albumIdsResolved) {
      albumIds.add(id);
    }
  }

  const trackIdsSelected = await prisma.track.findMany({
    select: { id: true },
    where: {
      deleted: false,
      track_artist_rel: {
        some: {
          artist_id: { in: artistIds.map(({ id }) => id) },
        },
      },
    },
  });

  const trackIds = trackIdsSelected.map(({ id }) => id);

  const trackArtistIds = await prisma.track_artist_rel.findMany({
    select: { track_id: true, artist_id: true },
    where: {
      track_id: { in: trackIds },
      artist_id: { in: artistIds.map(({ id }) => id) },
    },
  });

  const artistImageIds = await prisma.artist_image.findMany({
    select: { id: true },
    where: {
      deleted: false,
      artist_image_rel: {
        some: {
          artist_id: { in: artistIds.map(({ id }) => id) },
          is_cover: true,
        },
      },
    },
  });

  const trackAlbumIds = await prisma.track_album_rel.findMany({
    select: { track_id: true, album_id: true, track_position: true },
    where: {
      track_id: { in: trackIds },
      album_id: { in: [...albumIds] },
    },
  });

  const genreIds = await prisma.genre.findMany({
    select: { id: true },
    where: {
      deleted: false,
      track_genre_rel: { some: { track_id: { in: trackIds } } },
    },
  });

  const trackGenreIds = await prisma.track_genre_rel.findMany({
    select: { track_id: true, genre_id: true },
    where: {
      track_id: { in: trackIds },
      genre_id: {
        in: genreIds.map(({ id }) => id),
      },
    },
  });

  const albumImageIds = await prisma.album_image.findMany({
    select: { id: true },
    where: {
      deleted: false,
      album_image_rel: {
        some: {
          album_id: { in: [...albumIds] },
          is_cover: true,
        },
      },
    },
  });

  const trackPlaylistIds = await prisma.track_playlist_rel.findMany({
    select: { playlist_id: true },
    where: {
      playlist: {
        deleted: false,
      },
      track_id: { in: trackIds },
    },
  });

  const tablesPreview = (JSON.parse(JSON.stringify(tables)) as TablePreview[])
    .filter(({ name }) => name !== "track_language_rel")
    .map((table) => {
      if (table.name === "track") {
        table.where = trackIds.map((id) => ({ id }));
      } else if (table.name === "artist") {
        table.where = artistIds;
      } else if (table.name === "track_artist_rel") {
        table.where = trackArtistIds.map(({ track_id, artist_id }) => ({
          track_id,
          artist_id,
        }));
      } else if (table.name === "artist_image") {
        table.where = artistImageIds;
      } else if (table.name === "artist_image_rel") {
        table.where = artistImageIds.map(({ id }) => ({
          image_id: id,
        }));
      } else if (table.name === "genre") {
        table.where = genreIds;
      } else if (table.name === "track_genre_rel") {
        table.where = trackGenreIds.map(({ track_id, genre_id }) => ({
          track_id,
          genre_id,
        }));
      } else if (table.name === "album") {
        table.where = [...albumIds].map((id) => ({ id }));
      } else if (table.name === "track_album_rel") {
        table.where = trackAlbumIds.map(
          ({ track_id, album_id, track_position }) => ({
            track_id,
            album_id,
            track_position,
          })
        );
      } else if (table.name === "album_image") {
        table.where = albumImageIds;
      } else if (table.name === "album_image_rel") {
        table.where = albumImageIds.map(({ id }) => ({
          image_id: id,
        }));
      } else if (table.name === "track_playlist_rel") {
        table.where = trackPlaylistIds.map(({ playlist_id }) => ({
          playlist_id,
        }));
      }

      return table;
    });

  return tablesPreview;
}

export { fetchTables, fetchPreview };
