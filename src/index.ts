import createDir from "./dir";
import dumpDatabaseIterably from "./dump_split";
import dumpDatabase from "./dump";
import * as http from "http";
import * as dotenv from "dotenv";

let isPreview = false;
let isSplit = false;
let endpoint = "tables";

dotenv.config();

const SERVER_HOST = process.env.SERVER_HOST;
const SERVER_PORT = process.env.SERVER_PORT;

let tablesCount = 0;

const relatedScriptsCount = 2;
let prefixLength = 0;
let sqlScriptIndex = 0;

type DbTable = { name: string; where?: { [key: string]: number }[] };

createDir().then(async () => {
  const argv = process.argv.slice(2);

  if (argv.includes("--preview")) {
    isPreview = true;
    endpoint = "preview";
  }

  if (argv.includes("--split")) {
    isSplit = true;
  }

  if (argv.includes("--split") || isPreview) {
    const tables = await requestTables();

    tablesCount = tables.length;
    prefixLength = getPrefixWidth(tables.length);

    dumpDatabaseIterably(tables);
  } else {
    dumpDatabase();
  }
});

function requestTables() {
  return new Promise<DbTable[]>((resolve, reject) => {
    http.get(
      `http://${SERVER_HOST}:${SERVER_PORT}/api/${endpoint}`,
      (response) => {
        let body = "";

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          resolve(JSON.parse(body));
        });

        response.on("error", (error) => reject(error));
      }
    );
  });
}

const getPrefixWidth = (tablesLength: number) =>
  (tablesLength + relatedScriptsCount).toString().length;

const getSqlFilePrefix = () => {
  const zerosLength = prefixLength - sqlScriptIndex.toString().length;
  let zeros = "";

  for (let index = 0; index < zerosLength; index++) {
    zeros += "0";
  }

  return (zeros += sqlScriptIndex++);
};

export { isSplit, tablesCount, getSqlFilePrefix };
export type { DbTable };
