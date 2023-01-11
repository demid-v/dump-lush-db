import createDir from "./dir";
import dumpDatabaseIterably from "./dump_split";
import dumpDatabase from "./dump";
import * as dotenv from "dotenv";
import { fetchPreview, fetchTables } from "./queries";

let isPreview = false;
let isSplit = false;

dotenv.config();

let tablesCount = 0;

const relatedScriptsCount = 2;
let prefixLength = 0;
let sqlScriptIndex = 0;

const argv = process.argv.slice(2);

createDir().then(async () => {
  if (argv.includes("--preview")) {
    isPreview = true;
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

async function requestTables() {
  const tables = await (isPreview ? fetchPreview() : fetchTables());

  return tables;
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

export { isSplit, tablesCount, argv, getSqlFilePrefix };
