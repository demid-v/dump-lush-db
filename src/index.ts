import createDir from "./dir";
import dumpDatabaseSplit from "./dump_split";
import dumpDatabase from "./dump";

createDir().then(() => {
  if (process.argv.slice(2).includes("--split")) {
    dumpDatabaseSplit();
  } else {
    dumpDatabase();
  }
});
