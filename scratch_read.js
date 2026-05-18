import fs from 'fs';
const content = fs.readFileSync('add_tracking.sql', 'utf16le');
console.log(content);
