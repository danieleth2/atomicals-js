export interface AtomicalFileData {
    name: string;
    contentType: string; // If it's 'object' then it will be treated as raw json
    data: Buffer | any;
}