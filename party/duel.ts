import { makeDuel } from "../src/lib/duel/engine";
import { isWord } from "./dictionary";
import { roomServer } from "./room";

export default roomServer(makeDuel(isWord));
