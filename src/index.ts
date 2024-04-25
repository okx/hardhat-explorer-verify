import { extendConfig, task } from "hardhat/config";

import { TASK_VERIFY } from "./constants";

extendConfig((config) => {
    // @ts-ignore
  config['oklint'] = async () => console.log("Hello, OKX!");
});


task(TASK_VERIFY, "Prints 'Hello, World!'")
  .setAction(async () => {
    console.log("Hello, World!");
    return
  });