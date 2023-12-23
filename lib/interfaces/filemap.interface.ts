export interface FileMap {
    [inputIndex: string]: {
        directory: string;
        files: {
            [fileName: string]: {
                fileName: string;
                fileNameWithExtension: string;
                detectedExtension: string;
                fullPath: string;
                contentType: string;
                contentLength: number;
                body: any;
            }
        }
    }
} 