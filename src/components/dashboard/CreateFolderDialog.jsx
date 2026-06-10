import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FOLDER_COLORS } from '@/components/dashboard/FolderCard';

const COLOR_OPTIONS = ['amber', 'blue', 'emerald', 'purple', 'rose', 'cyan', 'orange'];

export default function CreateFolderDialog({ open, onOpenChange, onCreate }) {
  const [name, setName] = useState('');
  const [folderType, setFolderType] = useState('custom');
  const [color, setColor] = useState('amber');

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), folder_type: folderType, color });
    setName('');
    setFolderType('custom');
    setColor('amber');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">New Folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Arina Cheskey, Dark Fantasy Series…"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
            <Select value={folderType} onValueChange={setFolderType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="author">Author / Pen Name</SelectItem>
                <SelectItem value="series">Book Series</SelectItem>
                <SelectItem value="custom">Custom Folder</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Color</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition ${
                    color === c ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: `var(--color-${c}, ${c})` }}
                >
                  <span className={`block h-full w-full rounded-full bg-${c}-500`} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>Create Folder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}