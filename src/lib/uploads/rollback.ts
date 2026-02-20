import { deleteUploadedFile } from "./delete";

type PendingUpload = {
  url: string;
};

export class UploadRollbackManager {
  private uploads: PendingUpload[] = [];
  private committed = false;

  add(upload: PendingUpload) {
    if (this.committed) {
      throw new Error("Cannot add uploads after commit");
    }
    this.uploads.push(upload);
  }

  commit() {
    this.committed = true;
    this.uploads = [];
  }

  async rollback(): Promise<{ deleted: number; failed: number }> {
    if (this.committed || this.uploads.length === 0) {
      return { deleted: 0, failed: 0 };
    }

    let deleted = 0;
    let failed = 0;

    for (const upload of this.uploads) {
      const ok = await deleteUploadedFile(upload.url);
      if (ok) {
        deleted += 1;
      } else {
        failed += 1;
      }
    }

    this.uploads = [];
    return { deleted, failed };
  }
}
