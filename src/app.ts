import fs from 'fs';
import express, { Application } from 'express';
import joi from 'joi';

const app: Application = express();

//Middleware 
app.use(express.json());


interface user {
    "name": string;
    "email": string;
    "password": string;
    "userId": string;
    "role": string;
    "isDeleted": boolean;
    "token"?: string;
}


//readFile that exist in folder Struct
const readFile = (filePath: string): user[] => {
    if (!fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8").trim() == "") {
        const adminData:user[] = [{
            "name": "abhishekh kumar",
            "email": "abhi1@gmail.com",
            "password": "1234",
            "userId": "1",
            "role": "admin",
            "isDeleted": false,
            "token": ""
        }];
        fs.writeFileSync(filePath, JSON.stringify(adminData));
    }
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
};

const writeFile = (filePath: string, data: user[]) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

//Validation of emailId
function validateEmail(email: string): boolean {
    const emailPattern: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
}

//Validation of given requestData
function isValidData(obj: user, dataArray: string[]): boolean {
    return dataArray.every((it) => Object.prototype.hasOwnProperty.call(obj, it));
}

//find if user gmail all ready exists in file
function findUser(data: string, users: user[]) {
    return users.find((it) => it.email === data);
}

//find if user gmail all ready exists in file
function findUserId(data: string, users: user[]){
    return users.find((it) => it.userId === data);
}


app.post("/signup", (req: express.Request, res: express.Response| any) => {

    const requestData: user = req.body;

    console.log(requestData);
    console.log(requestData.email);

    const users: user[] = readFile("text.txt");

    if (!validateEmail(requestData.email)) {
        return res.status(400).send(JSON.stringify({ message: "Invalid user email" }));
    }
    if (!isValidData(requestData, ["name", "email", "password", "userId", "role", "isDeleted"])) {
        return res.status(400).send(JSON.stringify({ message: "Invalid user format" }));
    }
    if (findUser(requestData.email.toLowerCase(), users)) {
        return res.status(409).send(JSON.stringify({ message: "Email already exists" }));
    }
    if (findUserId(requestData.userId.toLowerCase(), users)) {
        return res.status(409).send(JSON.stringify({ message: "userId already exists" }));
    }
    if (requestData.role.toLowerCase() === "admin") {
        return res.status(409).send(JSON.stringify({ message: "you can not be admin" }));
    }
    users.push(requestData);
    writeFile("user.txt", users);
    return res.status(201).send(JSON.stringify({ message: "User registered successfully" }));
});

app.post("/login", (req: express.Request, res: express.Response | any) => {

})

const PORT = 4400;

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));