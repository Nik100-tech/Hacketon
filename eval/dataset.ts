import type { Turn } from "../core/schema.js";
export const scenario: Turn[] = [
 {n:1,role:"user",text:"We are building a blood bank stock management system. PostgreSQL is mandatory."},
 {n:2,role:"assistant",text:"PostgreSQL is the backend database."},
 {n:3,role:"user",text:"Firebase is rejected because we don't want the cost or vendor lock-in."},
 {n:4,role:"assistant",text:"Firebase should not be proposed."},
 {n:5,role:"user",text:"The demo deadline is Friday at 5pm."},
 {n:6,role:"assistant",text:"Friday 5pm is the hard deadline."},
 {n:7,role:"user",text:"The rare blood group emergency finder is a must-have."},
 {n:8,role:"assistant",text:"That module is critical."},
 {n:9,role:"user",text:"Expiry alerts are also important. The logo is not important."},
 {n:10,role:"assistant",text:"Expiry alerts matter more than visual polish."},
 {n:11,role:"user",text:"We considered MongoDB but rejected it; keep PostgreSQL."},
 {n:12,role:"assistant",text:"MongoDB is rejected."},
 {n:13,role:"user",text:"The team has finished the donor management screen."},
 {n:14,role:"assistant",text:"Donor management is completed."},
 {n:15,role:"user",text:"Actually, for the final prototype we will use Node.js and Express for the API."},
 {n:16,role:"assistant",text:"Node.js and Express are the API stack."},
 {n:17,role:"user",text:"Ignore the color palette; it can change later."},
 {n:18,role:"assistant",text:"Understood."}
];
