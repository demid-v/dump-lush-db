import * as fs from "fs";
import { spawn } from "child_process";
import { dumpDir } from "./dir";

function dumpDatabase() {
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

export default dumpDatabase;
