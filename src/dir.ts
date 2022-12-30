import * as fs from "fs";
import * as readline from "readline";

const defaultDumpDir = "./dump";
let dumpDir = defaultDumpDir;

async function createDir() {
  if (process.argv.slice(2)[1] !== "--default-dir") {
    try {
      dumpDir = await promptDirPath();
    } catch (error) {
      console.log(error);
    }
  }

  if (!fs.existsSync(dumpDir)) {
    fs.mkdirSync(dumpDir);
    console.log(`"${dumpDir}" directory created.`);
  }

  console.log(`Using "${dumpDir}" directory.`);
}

async function promptDirPath() {
  return new Promise<string>((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let dirPath = "";

    rl.question("Directory: ", (dirPathOut) => {
      dirPath = dirPathOut;
      rl.close();
    });

    rl.on("close", () => {
      try {
        if (fs.lstatSync(dirPath).isDirectory()) {
          resolve(dirPath);
        }

        reject("Invalid directory path");
      } catch (error) {
        reject("Invalid directory path. " + error);
      }
    });

    rl.on("error", () => {
      reject("Error occured in `promptDirPath`");
    });
  });
}

export default createDir;
export { dumpDir };
