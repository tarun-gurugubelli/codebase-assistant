import { FileTreeNode } from '../types/session.types';

export function buildFileTree(filePaths: string[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '', path: '', type: 'directory', children: [] };

  for (const filePath of filePaths.sort()) {
    const parts = filePath.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const nodePath = parts.slice(0, i + 1).join('/');
      const isFile = i === parts.length - 1;

      if (isFile) {
        current.children!.push({ name, path: nodePath, type: 'file' });
      } else {
        let dir = current.children!.find(n => n.name === name && n.type === 'directory');
        if (!dir) {
          dir = { name, path: nodePath, type: 'directory', children: [] };
          current.children!.push(dir);
        }
        current = dir;
      }
    }
  }

  return root.children ?? [];
}
