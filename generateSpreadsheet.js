import config from './config.json' assert { type: "json" };
import { readFileSync, writeFileSync } from 'fs';
import xlsx from 'node-xlsx';
import Ajv from 'ajv';

function validateConfigFile() {
    const schemaData = readFileSync('schema.json');
    const configData = readFileSync('config.json');

    const schema = JSON.parse(schemaData);
    const config = JSON.parse(configData);

    const ajv = new Ajv();
    const validate = ajv.compile(schema);

    const isValid = validate(config);

    if (!isValid) {
        console.error('Invalid config file:', ajv.errorsText(validate.errors));
        process.exit(1);
    }
}

// Make sure the config file follows the schema properly.
validateConfigFile();

// Setup each row with default values.
let row1 = [null, null];
let row2 = ['Item', 'Price'];

// Add every single player and add their team name one cell above them.
for (let team of config['teams']) {
    for (let member of team.members) {
        row1.push(team.name);
        row2.push(member);
    }
}

// Create the buffer and try to save the file.
let data = [row1, row2]
let buffer = xlsx.build([{ name: 'Sheet1', data: data }]);
try {
    writeFileSync('book.xlsx', buffer);
    console.log(`Success. Generated \'book.xlsx\'`);
} catch (err) {
    console.log('Error', err);
}