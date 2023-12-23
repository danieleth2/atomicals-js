import { CommandInterface } from "./command.interface";
import { FileMap } from "../interfaces/filemap.interface";

export function isImage(contentType: string): boolean {
  return /^image\/(jpe?g|png|gif|bmp|webp|svg)$/.test(contentType);
}

export function isText(contentType: string): boolean {
  return /utf\-?8|application\/json|text\/plain|markdown|xml|html/.test(contentType)
}

export class RenderPreviewsCommand implements CommandInterface {
  constructor(private filesmap: FileMap, private body: boolean
  ) {
  }
  async run(): Promise<any> {
    for (const inputIndex in this.filesmap) {
      if (!this.filesmap.hasOwnProperty(inputIndex)) {
        continue;
      }
      console.log(`-------------------------------------------------`);
      console.log(`Rendering files at inputIndex ${inputIndex}`);
      for (const filename in this.filesmap[inputIndex].files) {
        if (!this.filesmap[inputIndex].files.hasOwnProperty(filename)) {
          continue;
        }
        console.log(`-------------------------------------------------`);
        console.log(`Rendering file ${filename}`);
        const filepath = this.filesmap[inputIndex].files[filename].fullPath;
        const contentType = this.filesmap[inputIndex].files[filename].contentType;
        const contentLength = this.filesmap[inputIndex].files[filename].contentLength;
        const body = this.filesmap[inputIndex].files[filename].body;
        console.log('File name: ', filename);
        console.log('Full path: ', filepath);
        console.log('Content Type: ', contentType);
        console.log('Content Length: ', contentLength);
        if (this.body) {
          console.log('Body (hex encoded): ', this.filesmap[inputIndex].files[filename].body);
        }
        if (isImage(contentType)) {
          const {default: terminalImage} = await import("terminal-image");
          console.log(await terminalImage.file(filepath));
        } else if (isText(contentType)) {
          console.log('Body decoded: ');
          console.log(Buffer.from(this.filesmap[inputIndex].files[filename].body, 'hex').toString('utf8'));
        } else {
          console.log(`File is not an image or text-like. View file manually at ${filepath}`)
        }
      }
    }
    /*
    displayImage.fromFile("banner.png").then(image => {
      console.log(image)
    }) 

    displayImage.fromFile("shadow.gif").then(image => {
      console.log(image)
    }) 

    displayImage.fromFile("ape.png").then(image => {
      console.log(image)
    }) 

    displayImage.fromFile("pepe.png").then(image => {
      console.log(image)
    }) */

    return null;
  }
}

/*

 // Remove the body by default
      if (!body) {
        for (const inputIndex in result.data.filemap) {
          if (!result.data.filemap.hasOwnProperty(inputIndex)) {
            continue;
          }
          for (const filename in result.data.filemap[inputIndex].files) {
            if (!result.data.filemap[inputIndex].files.hasOwnProperty(filename)) {
              continue;
            }
            const fileEntry = result.data.filemap[inputIndex].files[filename];
            delete fileEntry['body'];
          }
        }
      }

*/