<script lang="ts">
  import { resolve } from '$app/paths';
  import Logo from '$lib/assets/logo.png';
  import { deserialize } from '$app/forms';
  let readFileResult = '';
  let readDirResult = '';
  let readDirRecResult = '';
</script>

<div class="h-screen flex flex-col gap-1">
  <header class="h-16 flex bg-neutral-900">
    <div class="h-full w-full flex">
      <a href={resolve('/')} class="h-full px-3 pb-1 pt-2">
        <img src={Logo} alt="Logo" class="h-full rounded-full" />
      </a>
      <div class="h-full w-full flex flex-col justify-between">
        <form
          onsubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const response = await fetch('/fs?/readFile', {
              method: 'POST',
              body: JSON.stringify({ filePath: formData.get('filePath') }),
            });
            const result = deserialize(await response.text());
            if (result.type === 'success' && result.data) {
              readFileResult = result.data.fileContent;
            }
          }}
        >
          <input name="filePath" placeholder="File path" />
          <input type="submit" value="Read File" />
          <div style="white-space: pre;">
            {readFileResult}
          </div>
        </form>
        <form
          onsubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const response = await fetch('/fs?/readDir', {
              method: 'POST',
              body: JSON.stringify({ dirPath: formData.get('dirPath') }),
            });
            const result = deserialize(await response.text());
            readDirResult = '';
            if (result.type === 'success' && result.data) {
              readDirResult += 'Files: ' + result.data.dirContent.files.join(' ') + '\n';
              readDirResult += 'Directories: ';
              Object.keys(result.data.dirContent.directories).forEach((dir) => {
                readDirResult += dir + ' ';
              });
            }
          }}
        >
          <input name="dirPath" placeholder="Dir path to list" />
          <input type="submit" value="List Directory" />
          <div style="white-space: pre;">
            {readDirResult}
          </div>
        </form>
        <form
          onsubmit={async (e) => {
            function renderReadDirResult(dirContent, deep = 0) {
              let res = '';
              res += ' '.repeat(deep) + '| Files: ' + dirContent.files.join(' ') + '\n';
              res += ' '.repeat(deep) + '| Directories:\n';
              Object.entries(dirContent.directories).forEach(([dirName, content]) => {
                res +=
                  ' '.repeat(deep) +
                  '|--- ' +
                  dirName +
                  '\n' +
                  renderReadDirResult(content, deep + 8);
              });
              return res;
            }

            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const response = await fetch('/fs?/readDirRec', {
              method: 'POST',
              body: JSON.stringify({ dirPath: formData.get('dirPath') }),
            });
            const result = deserialize(await response.text());
            readDirRecResult = '';
            if (result.type === 'success' && result.data) {
              readDirRecResult = renderReadDirResult(result.data.dirContent);
            }
          }}
        >
          <input name="dirPath" placeholder="Dir path to list" />
          <input type="submit" value="List Directory Recursively" />
          <div style="white-space: pre;">
            {readDirRecResult}
          </div>
        </form>
        <form
          onsubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            fetch('/fs?/writeFile', {
              method: 'POST',
              body: JSON.stringify({
                filePath: formData.get('filePath'),
                fileContent: formData.get('fileContent'),
              }),
            });
          }}
        >
          <input name="filePath" placeholder="File path" />
          <input name="fileContent" placeholder="File content" />
          <input type="submit" value="Write File" />
        </form>
        <form
          onsubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            fetch('/fs?/deleteFile', {
              method: 'POST',
              body: JSON.stringify({ filePath: formData.get('filePath') }),
            });
          }}
        >
          <input name="filePath" placeholder="File path" />
          <input type="submit" value="Delete File" />
        </form>
        <form
          onsubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            fetch('/fs?/renameFile', {
              method: 'POST',
              body: JSON.stringify({
                filePath: formData.get('filePath'),
                newFilePath: formData.get('newFilePath'),
              }),
            });
          }}
        >
          <input name="filePath" placeholder="File path" />
          <input name="newFilePath" placeholder="New File Path" />
          <input type="submit" value="Rename File" />
        </form>
        <form
          onsubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            fetch('/fs?/createDir', {
              method: 'POST',
              body: JSON.stringify({ dirPath: formData.get('dirPath') }),
            });
          }}
        >
          <input name="dirPath" placeholder="Directory path" />
          <input type="submit" value="Create Directory" />
        </form>
        <form
          onsubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            fetch('/fs?/renameDir', {
              method: 'POST',
              body: JSON.stringify({
                dirPath: formData.get('dirPath'),
                newDirPath: formData.get('newDirPath'),
              }),
            });
          }}
        >
          <input name="dirPath" placeholder="Directory path" />
          <input name="newDirPath" placeholder="New Directory Path" />
          <input type="submit" value="Rename Directory" />
        </form>
      </div>
    </div>
  </header>
</div>
