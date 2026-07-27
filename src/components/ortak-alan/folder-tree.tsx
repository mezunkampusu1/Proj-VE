"use client";

import { useState } from "react";
import { ChevronRight, Folder, FolderOpen, FolderTree as FolderTreeIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FolderNode {
  id: string;
  name: string;
  parentFolderId: string | null;
}

interface Props {
  folders: FolderNode[];
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
}

function buildTree(folders: FolderNode[], parentId: string | null): FolderNode[] {
  return folders.filter((f) => f.parentFolderId === parentId);
}

function FolderRow({
  folder,
  folders,
  depth,
  selectedFolderId,
  onSelect,
}: {
  folder: FolderNode;
  folders: FolderNode[];
  depth: number;
  selectedFolderId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = buildTree(folders, folder.id);
  const isSelected = selectedFolderId === folder.id;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
          isSelected && "bg-accent font-medium text-foreground",
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => onSelect(folder.id)}
      >
        {children.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        {isSelected ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate text-foreground">{folder.name}</span>
      </div>
      {expanded &&
        children.map((child) => (
          <FolderRow key={child.id} folder={child} folders={folders} depth={depth + 1} selectedFolderId={selectedFolderId} onSelect={onSelect} />
        ))}
    </div>
  );
}

/** Klasör ağacı — düz listeden (bkz. GET /api/document-folders) istemci tarafında oluşturulur (§ ana ekran). */
export function FolderTree({ folders, selectedFolderId, onSelect }: Props) {
  const roots = buildTree(folders, null);

  return (
    <div className="space-y-0.5">
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
          selectedFolderId === null && "bg-accent font-medium text-foreground",
        )}
        onClick={() => onSelect(null)}
      >
        <FolderTreeIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-foreground">Tüm Klasörler</span>
      </div>
      {roots.map((folder) => (
        <FolderRow key={folder.id} folder={folder} folders={folders} depth={0} selectedFolderId={selectedFolderId} onSelect={onSelect} />
      ))}
    </div>
  );
}
