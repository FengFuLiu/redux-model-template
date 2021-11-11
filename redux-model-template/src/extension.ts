import * as vscode from 'vscode';
const fs = require('fs');
const fsPromises = fs.promises;


const isFile = (fileName: string) => {
  return fs.lstatSync(fileName).isFile();
};

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


export function activate(context: vscode.ExtensionContext) {

  let disposable = vscode.commands.registerCommand('redux-model-template.createReduxModelTemplate', async (param) => {
    const folderPath = param.fsPath;
    const name = await vscode.window.showInputBox({
      placeHolder: `Enter your model name`
    });
    if (name) {
      const path = `${folderPath}/${name}`;
      try {
        let apiSnippet = '';
        const apiSnippets = await getApiSnippetsFromFolder(folderPath);

        switch (apiSnippets.length) {
          case 0:
            // 当前目录找不到api就去上级目录遍历下来找一次
            const parentDir = folderPath.slice(0, folderPath.lastIndexOf('/'));
            const dirPathList: string[] = fs.readdirSync(parentDir)?.map((name: string) => `${parentDir}/${name}`);
            if (dirPathList.length) {
              const parentDirApiSnippetsList = await Promise.all(dirPathList.map(dirPath => getApiSnippetsFromFolder(dirPath)));
              const deletedDuplicateApiSnippetsList = [...new Set(parentDirApiSnippetsList.flat())].filter(Boolean);
              if (deletedDuplicateApiSnippetsList.length === 1) {
                apiSnippet = deletedDuplicateApiSnippetsList[0];
              } else if (deletedDuplicateApiSnippetsList.length > 1) {
                apiSnippet = await showApiSnippetsSelect(deletedDuplicateApiSnippetsList) ?? "";
              }
            }
            break;
          case 1:
            apiSnippet = apiSnippets[0];
            break;
        }

        if (apiSnippets.length > 1) {
          apiSnippet = await showApiSnippetsSelect(apiSnippets) ?? "";
        }
        console.log(apiSnippet, 'apiSnippet');

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
