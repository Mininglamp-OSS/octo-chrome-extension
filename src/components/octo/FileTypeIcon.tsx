/**
 * 文件类型图标 —— 1:1 移植自 mirror
 * dmworkbase/src/Messages/File/index.tsx 中 FileTypeIcon
 */

export function getExtension(extension: string, name?: string): string {
  const ext = (extension || "").toLowerCase();
  if (ext) return ext;
  if (name) {
    const dot = name.lastIndexOf(".");
    if (dot >= 0) return name.substring(dot + 1).toLowerCase();
  }
  return "";
}

export function getFileIconInfo(
  extension: string,
  name?: string,
): { color: string; label: string } {
  const ext = getExtension(extension, name);
  switch (ext) {
    case "pdf":
      return { color: "#EF4444", label: "PDF" };
    case "doc":
    case "docx":
      return { color: "#3B82F6", label: "DOC" };
    case "xls":
    case "xlsx":
      return { color: "#22C55E", label: "XLS" };
    case "ppt":
    case "pptx":
      return { color: "#F97316", label: "PPT" };
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
      return { color: "#EAB308", label: "ZIP" };
    case "mp3":
    case "wav":
    case "flac":
    case "aac":
      return { color: "#A855F7", label: "MP3" };
    case "mp4":
    case "avi":
    case "mov":
    case "mkv":
      return { color: "#EC4899", label: "MP4" };
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "bmp":
    case "webp":
      return { color: "#14B8A6", label: "IMG" };
    case "txt":
    case "md":
      return { color: "#6B7280", label: "TXT" };
    default:
      return { color: "#9CA3AF", label: "FILE" };
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function FileTypeIcon({ extension, name }: { extension: string; name?: string }) {
  const ext = getExtension(extension, name);

  if (ext === "pdf") {
    return (
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <title>PDF</title>
        <rect width="40" height="40" rx="8" fill="#FEE2E2" />
        <path
          d="M12 10C12 8.9 12.9 8 14 8H24L30 14V30C30 31.1 29.1 32 28 32H14C12.9 32 12 31.1 12 30V10Z"
          fill="#EF4444"
        />
        <path d="M24 8L30 14H26C24.9 14 24 13.1 24 12V8Z" fill="#FCA5A5" />
        <text x="20" y="26" textAnchor="middle" fill="white" fontSize="7" fontWeight="700" fontFamily="sans-serif">PDF</text>
      </svg>
    );
  }

  if (ext === "doc" || ext === "docx") {
    return (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <title>DOC</title>
        <rect width="40" height="40" rx="8" fill="#DBEAFE" />
        <path
          d="M12 10C12 8.9 12.9 8 14 8H24L30 14V30C30 31.1 29.1 32 28 32H14C12.9 32 12 31.1 12 30V10Z"
          fill="#3B82F6"
        />
        <path d="M24 8L30 14H26C24.9 14 24 13.1 24 12V8Z" fill="#93C5FD" />
        <text x="20" y="26" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="700" fontFamily="sans-serif">DOC</text>
      </svg>
    );
  }

  if (ext === "xls" || ext === "xlsx") {
    return (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <title>XLS</title>
        <rect width="40" height="40" rx="8" fill="#DCFCE7" />
        <path
          d="M12 10C12 8.9 12.9 8 14 8H24L30 14V30C30 31.1 29.1 32 28 32H14C12.9 32 12 31.1 12 30V10Z"
          fill="#22C55E"
        />
        <path d="M24 8L30 14H26C24.9 14 24 13.1 24 12V8Z" fill="#86EFAC" />
        <text x="20" y="26" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="700" fontFamily="sans-serif">XLS</text>
      </svg>
    );
  }

  if (ext === "ppt" || ext === "pptx") {
    return (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <title>PPT</title>
        <rect width="40" height="40" rx="8" fill="#FFEDD5" />
        <path
          d="M12 10C12 8.9 12.9 8 14 8H24L30 14V30C30 31.1 29.1 32 28 32H14C12.9 32 12 31.1 12 30V10Z"
          fill="#F97316"
        />
        <path d="M24 8L30 14H26C24.9 14 24 13.1 24 12V8Z" fill="#FDba74" />
        <text x="20" y="26" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="700" fontFamily="sans-serif">PPT</text>
      </svg>
    );
  }

  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <title>ZIP</title>
        <rect width="40" height="40" rx="8" fill="#FEF9C3" />
        <path
          d="M12 10C12 8.9 12.9 8 14 8H24L30 14V30C30 31.1 29.1 32 28 32H14C12.9 32 12 31.1 12 30V10Z"
          fill="#EAB308"
        />
        <path d="M24 8L30 14H26C24.9 14 24 13.1 24 12V8Z" fill="#FDE047" />
        <text x="20" y="26" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="700" fontFamily="sans-serif">ZIP</text>
      </svg>
    );
  }

  // 通用文件
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <title>FILE</title>
      <rect width="40" height="40" rx="8" fill="#F3F4F6" />
      <path
        d="M12 10C12 8.9 12.9 8 14 8H24L30 14V30C30 31.1 29.1 32 28 32H14C12.9 32 12 31.1 12 30V10Z"
        fill="#9CA3AF"
      />
      <path d="M24 8L30 14H26C24.9 14 24 13.1 24 12V8Z" fill="#D1D5DB" />
      <line x1="16" y1="20" x2="26" y2="20" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="24" x2="22" y2="24" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
