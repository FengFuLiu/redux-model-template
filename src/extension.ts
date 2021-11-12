import * as vscode from 'vscode';
const fs = require('fs');
const fsPromises = fs.promises;


const isFile = (fileName: string) => fs.lstatSync(fileName).isFile();

const isDirectory = (fileName: string) => fs.lstatSync(fileName).isDirectory();


const findApiSnippetStr = (str: string) =>
  str.match(/import.*?;/g)?.filter(text => text.includes('$') && !text.includes(','));

const getApiSnippetsFromFolder = async (folderPath: string) => {
  const filesList: string[] = (await fsPromises.readdir(folderPath));
  const filePathList = filesList.map(item => `${folderPath}/${item}`).filter(isFile);
  const contentList: string[] = await Promise.all(filePathList.map(path => fsPromises.readFile(path, 'utf8')));
  return [...new Set(contentList.map(findApiSnippetStr).flat())].filter(Boolean) as string[];
};

const showApiSnippetsSelect = async (apiSnippets: string[]) => {
  const res = await vscode.window.showQuickPick([...apiSnippets, 'None of them'], { canPickMany: false });
  return res !== 'None of them' ? res : '';
};

const firstUpperCase = (str: string) => str.replace(/^\S/, s => s.toUpperCase());

const firstLowerCase = (str: string) => str.replace(/^\S/, s => s.toLowerCase());


export function activate(context: vscode.ExtensionContext) {

  let disposable = vscode.commands.registerCommand('redux-model-template.createReduxModelTemplate', async (param) => {
    const folderPath = param.fsPath;
    const name = await vscode.window.showInputBox({
      placeHolder: `Enter your model name like 'Course' or 'course'`
    });
    if (name) {
      try {
        let apiSnippet = '';
        const parentDir = folderPath.slice(0, folderPath.lastIndexOf('/'));
        const dirPathList: string[] = fs.readdirSync(parentDir)?.map((name: string) => `${parentDir}/${name}`).filter((item: string) => isDirectory(item));
        if (dirPathList.length) {
          const parentDirApiSnippetsList = await Promise.all(dirPathList.map(dirPath => getApiSnippetsFromFolder(dirPath)));
          const deletedDuplicateApiSnippetsList = [...new Set(parentDirApiSnippetsList.flat())].filter(Boolean);
          if (deletedDuplicateApiSnippetsList.length === 1) {
            apiSnippet = deletedDuplicateApiSnippetsList[0];
          } else if (deletedDuplicateApiSnippetsList.length > 1) {
            apiSnippet = await showApiSnippetsSelect(deletedDuplicateApiSnippetsList) ?? "";
          }
        }
        const api = apiSnippet.match(/{(.*?)}/)?.[1].trim() ?? '';
        const content = api ? `import { Model } from '@redux-model/react';
${apiSnippet}

type Response = {};

type Data = Response;

class ${firstUpperCase(name)}Model extends Model<Data> {
  manage = ${api}.action(() =>
    this.get<Response>('').onSuccess((_, action) => {
      return action.response;
    }),
  );

  protected initialState(): Data {
    return {};
  }
}

export const ${firstLowerCase(name)}Model = new ${firstUpperCase(name)}Model();
`: `import { Model } from '@redux-model/react';

type Response = {};

type Data = Response;

class ${firstUpperCase(name)}Model extends Model<Data> {
  protected initialState(): Data {
    return {};
  }
}

export const ${firstLowerCase(name)}Model = new ${firstUpperCase(name)}Model();
`;
        fs.writeFileSync(`${folderPath}/${firstUpperCase(name)}Model.ts`, content);

        setTimeout(() => {
          const openPath = vscode.Uri.file(`${folderPath}/${firstUpperCase(name)}Model.ts`);
          vscode.workspace.openTextDocument(openPath).then(doc => {
            vscode.window.showTextDocument(doc);
          });
        }, 10);

      } catch (error) {
        vscode.window.showWarningMessage(String(error));
      }
    } else {
      vscode.window.showWarningMessage('Input cancel');
    }
  });

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }
