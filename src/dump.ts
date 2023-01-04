import * as fs from "fs";
import { spawn } from "child_process";
import { dumpDir } from "./dir";
import * as http from "http";

const SERVER_HOST = process.env.SERVER_HOST;
const SERVER_PORT = process.env.SERVER_PORT;

let tablesCount = 0;
let dumpedTableIndex = 0;

type DbTable = { name: string; where?: { [key: string]: number }[] };

function dumpDatabase() {
  if (process.argv.slice(2).includes("--preview")) {
    http.get(`http://${SERVER_HOST}:${SERVER_PORT}/api/preview`, (response) => {
      let body = "";

      response.on("data", (chunk) => {
        body += chunk;
      });

      response.on("end", () => {
        const tables = JSON.parse(body);

        tablesCount = tables.length;
        dumpPreview(tables);
      });
    });
  } else {
    dump();
  }
}

function dump() {
  return new Promise<number>((resolve, reject) => {
    console.log("Dumping Lush database...");

    const dumpSpawn = spawn("mysqldump", ["--databases", "lush", "--routines"]);

    const fd = fs.openSync(`${dumpDir}/dump.sql`, "w");

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
  }).then(() => console.log("Lush database dumped."));
}

async function dumpPreview(tables: DbTable[]) {
  console.log("Dumping Lush database...");

  await dumpStructure();
  await dumpTables(tables);
  await dumpRoutines();

  console.log("Lush database dumped.");
}

async function dumpStructure() {
  return new Promise<number>((resolve, reject) => {
    console.log("Dumping structure...");

    const dumpSpawn = spawn("mysqldump", ["--databases", "lush", "--no-data"]);

    const fd = fs.openSync(`${dumpDir}/dump.sql`, "w");

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
  for (const table of tables) {
    await dumpTable(table);
  }
}

async function dumpTable(table: DbTable) {
  return new Promise<string>((resolve, reject) => {
    console.log(`Dumping "${table.name}" table...`);

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
            index + 1,
            whereClauses.length,
            whereClause
          ).catch((error) => reject(error));
        }
      } else {
        await dumpPart(table).catch((error) => reject(error));
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
  iterationIndex: number,
  numOfIterations: number,
  whereClause?: string
) {
  return dumpPart(table, iterationIndex, numOfIterations, whereClause).then(
    () => {
      console.log(
        `[${iterationIndex}/${numOfIterations}] Iteration of table "${table.name}" done.`
      );
    }
  );
}

async function dumpPart(
  table: DbTable,
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

    const fd = fs.openSync(`${dumpDir}/dump.sql`, "a");

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

    const dumpSpawn = spawn("mysqldump", [
      "lush",
      "--routines",
      "--no-create-db",
      "--no-data",
      "--no-create-info",
    ]);

    const fd = fs.openSync(`${dumpDir}/dump.sql`, "a");

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

export default dumpDatabase;
