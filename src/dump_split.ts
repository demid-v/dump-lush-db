import * as fs from "fs";
import { spawn } from "child_process";
import { dumpDir } from "./dir";
import { DbTable, getSqlFilePrefix, isSplit, tablesCount } from ".";

let dumpedTableIndex = 0;

async function dumpDatabaseIterably(tables: DbTable[]) {
  console.log("Dumping Lush database...");

  if (isSplit) {
    await dumpAsynch(tables);
  } else {
    await dumpSynch(tables);
  }

  console.log("Lush database dumped.");
}

async function dumpAsynch(tables: DbTable[]) {
  const pendingDumps = [];
  pendingDumps.push(dumpStructure(), dumpTables(tables), dumpRoutines());
  await Promise.allSettled(pendingDumps);
}

async function dumpSynch(tables: DbTable[]) {
  await dumpStructure();
  await dumpTables(tables);
  await dumpRoutines();
}

async function dumpStructure() {
  return new Promise<number>((resolve, reject) => {
    console.log("Dumping structure...");

    const dumpFilePath = isSplit
      ? `${dumpDir}/${getSqlFilePrefix()}-structure-dump.sql`
      : `${dumpDir}/dump.sql`;

    const dumpSpawn = spawn("mysqldump", ["--databases", "lush", "--no-data"]);

    const fd = fs.openSync(dumpFilePath, "w");

    dumpSpawn.stdout.on("data", (data) => {
      fs.writeFileSync(fd, data);
    });

    dumpSpawn.on("exit", (code) => {
      fs.close(fd);
      code === 0 ? resolve(code) : reject(code);
    });

    dumpSpawn.on("error", (error) => {
      fs.close(fd);
      reject(error);
    });
  })
    .then(() => console.log("Structure dumped."))
    .catch((error) => console.error(error));
}

async function dumpTables(tables: DbTable[]) {
  const pendingDumps = [];
  for (const table of tables) {
    pendingDumps.push(dumpTable(table));
  }

  await Promise.allSettled(pendingDumps);
}

function writeUseDb(filePath: string) {
  fs.writeFileSync(filePath, "USE `lush`;\r\n\r\n");
}

async function dumpTable(table: DbTable) {
  return new Promise<string>((resolve, reject) => {
    console.log(`Dumping "${table.name}" table...`);

    const dumpFilePath = isSplit
      ? `${dumpDir}/${getSqlFilePrefix()}-${table.name}-dump.sql`
      : `${dumpDir}/dump.sql`;

    writeUseDb(dumpFilePath);

    (async () => {
      if (table.where) {
        const whereClauses: string[] = [];
        const where: string[] = [];

        for (const whereObj of table.where) {
          const whereInner = [];

          for (const [key, value] of Object.entries(whereObj)) {
            whereInner.push(`${key}=${value}`);
          }

          const whereInnerJoined = whereInner.join(" and ");
          const whereJoined = where.join(" or ");

          if (`${whereJoined} or ${whereInnerJoined}`.length > 256 * 50) {
            whereClauses.push(whereJoined);
            where.length = 0;
          }

          where.push(whereInnerJoined);
        }

        if (where.length > 0) {
          whereClauses.push(where.join(" or "));
        }

        for (const [index, whereClause] of whereClauses.entries()) {
          await dumpIteration(
            table,
            dumpFilePath,
            index + 1,
            whereClauses.length,
            whereClause
          ).catch((error) => reject(error));
        }
      } else {
        await dumpPart(table, dumpFilePath).catch((error) => reject(error));
      }
    })().then(() => resolve(table.name));
  })
    .then((tableName) => {
      console.log(
        `[${++dumpedTableIndex}/${tablesCount}] Table "${tableName}" dumped.`
      );
    })
    .catch((error) => console.error(error));
}

async function dumpIteration(
  table: DbTable,
  dumpFilePath: string,
  iterationIndex: number,
  numOfIterations: number,
  whereClause?: string
) {
  return dumpPart(
    table,
    dumpFilePath,
    iterationIndex,
    numOfIterations,
    whereClause
  ).then(() => {
    console.log(
      `[${iterationIndex}/${numOfIterations}] Iteration of table "${table.name}" done.`
    );
  });
}

async function dumpPart(
  table: DbTable,
  dumpFilePath: string,
  iterationIndex?: number,
  numOfIterations?: number,
  whereClause?: string
) {
  return new Promise<string>((resolve, reject) => {
    const dumpSpawn = spawn("mysqldump", [
      "lush",
      table.name,
      "--no-create-info",
      ...(whereClause ? ["--where", whereClause] : []),
    ]);

    const fd = fs.openSync(dumpFilePath, "a");

    let body = "";

    dumpSpawn.stdout.on("data", (data) => {
      body += data;
    });

    dumpSpawn.on("exit", (code) => {
      if (iterationIndex !== 1) {
        body = body.replace(`LOCK TABLES \`${table.name}\` WRITE;`, "");
      }

      if (iterationIndex < numOfIterations) {
        body = body.slice(0, body.lastIndexOf("UNLOCK TABLES;"));
      }

      fs.writeFileSync(fd, body);

      fs.close(fd);
      code === 0 ? resolve(table.name) : reject(code);
    });

    dumpSpawn.on("error", (error) => {
      fs.close(fd);
      reject(error);
    });
  });
}

async function dumpRoutines() {
  return new Promise<number>((resolve, reject) => {
    console.log("Dumping routines...");

    const dumpFilePath = isSplit
      ? `${dumpDir}/${getSqlFilePrefix()}-routines-dump.sql`
      : `${dumpDir}/dump.sql`;

    writeUseDb(dumpFilePath);

    const dumpSpawn = spawn("mysqldump", [
      "lush",
      "--routines",
      "--no-create-db",
      "--no-data",
      "--no-create-info",
    ]);

    const fd = fs.openSync(dumpFilePath, "a");

    dumpSpawn.stdout.on("data", (data) => {
      fs.writeFileSync(fd, data);
    });

    dumpSpawn.on("exit", (code) => {
      fs.close(fd);
      code === 0 ? resolve(code) : reject(code);
    });

    dumpSpawn.on("error", (error) => {
      fs.close(fd);
      reject(error);
    });
  })
    .then(() => {
      console.log("Routines dumped.");
    })
    .catch((error) => console.error(error));
}

export default dumpDatabaseIterably;
