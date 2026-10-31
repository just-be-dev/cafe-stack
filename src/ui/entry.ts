import { Runtime } from "foldkit";
import { AppClient } from "./api.ts";
import { init, Message, Model, update, view } from "./main.ts";
import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-mono/400.css";
import "./styles.css";

const application = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  container: document.getElementById("root"),
  resources: AppClient.layer,
  devTools: { Message },
});

Runtime.run(application);
