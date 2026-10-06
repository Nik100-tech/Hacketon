import { createHandover, toSystemPrompt } from "./extract.js";
import { diffHandovers } from "./diff.js";

const turns = [
  { n:1, role:"user" as const, text:"We're building a blood bank app. Backend must be PostgreSQL, Firebase is rejected because of cost." },
  { n:2, role:"assistant" as const, text:"Understood: PostgreSQL, no Firebase." },
  { n:3, role:"user" as const, text:"Lol the logo can be anything. Anyway, the demo is due Friday 5pm, that's a hard deadline." },
  { n:4, role:"assistant" as const, text:"Noted. Donor module is next." },
  { n:5, role:"user" as const, text:"For the hackathon, keep the app narrow: rare blood emergency finder and expiry alerts matter most." },
  { n:6, role:"assistant" as const, text:"Got it. Those are the priority modules." }
];

const h1 = await createHandover({ id:"h1", parent:null, turns, budget:400 });
console.log(JSON.stringify(h1, null, 2));
console.log("\nSYSTEM PROMPT:\n", toSystemPrompt(h1));
console.log("\nDIFF:\n", diffHandovers(null, h1));
