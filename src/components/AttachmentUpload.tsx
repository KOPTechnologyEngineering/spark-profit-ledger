import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Paperclip, X, FileText, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Attachment {
  name: string;
  path: string;
  type: string;
}

interface AttachmentUploadProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
}

export default function AttachmentUpload({ attachments, onAttachmentsChange }: AttachmentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    const newAttachments: Attachment[] = [];

    for (const file of Array.from(files)) {
      const path = `${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("transaction-attachments").upload(path, file);
      if (error) {
        toast({ title: "Upload failed", description: `${file.name}: ${error.message}`, variant: "destructive" });
        continue;
      }
      newAttachments.push({ name: file.name, path, type: file.type });
    }

    onAttachmentsChange([...attachments, ...newAttachments]);
    setUploading(false);
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label>Evidence / Attachments</Label>
      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm">
              {att.type.startsWith("image/") ? <Image className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
              <span className="flex-1 truncate text-foreground">{att.name}</span>
              <button type="button" onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-outflow">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div>
        <input type="file" id="attachment-upload" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleUpload} className="hidden" />
        <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("attachment-upload")?.click()} disabled={uploading}>
          <Paperclip className="h-4 w-4 mr-1" /> {uploading ? "Uploading..." : "Attach Files"}
        </Button>
      </div>
    </div>
  );
}
