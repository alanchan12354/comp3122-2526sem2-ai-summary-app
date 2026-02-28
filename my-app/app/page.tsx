'use client';

import { useState, useEffect } from "react";

export default function Home() {
  const [status, setStatus] = useState("Frontend running");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<{name: string; metadata?: { size?: number }}[]>([]);
  const [summaries, setSummaries] = useState<{ [key: string]: string }>({});
  const [summarizing, setSummarizing] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchFiles();
  }, []);

  async function checkBackend() {
    setStatus("Checking backend...");
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setStatus(`Backend says: ${data.message || 'Error parsing backend response'}`);
    } catch (e: unknown) {
      if (e instanceof Error) setStatus(`Backend error: ${e.message}`);
    }
  }

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/files');
      if (res.ok) {
        const data = await res.json();
        const validFiles = (data.files || []).filter((f: {name: string, metadata?: { size?: number }}) => f.name !== '.emptyFolderPlaceholder');
        setFiles(validFiles);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file first");
      return;
    }
    setUploading(true);
    setStatus("Uploading file...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch('/api/upload', {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus("File uploaded successfully");
      setFile(null);
      // reset file input
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      fetchFiles();
    } catch (error: unknown) {
      if (error instanceof Error) setStatus(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSummarize = async (fileName: string) => {
    setSummarizing((prev) => ({ ...prev, [fileName]: true }));
    try {
      const res = await fetch('/api/summary', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSummaries((prev) => ({ ...prev, [fileName]: data.summary }));
    } catch (error: unknown) {
      if (error instanceof Error) alert(`Summary failed: ${error.message}`);
    } finally {
      setSummarizing((prev) => ({ ...prev, [fileName]: false }));
    }
  };

  return (
    <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 800 }}>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">AI Summary App</h1>
      
      <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-sm w-fit border border-gray-100">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Backend Status check</h2>
        <button
          onClick={checkBackend}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded mb-2 transition-colors"
        >
          Check backend
        </button>
        <p className="text-sm text-gray-600 font-mono mt-2">{status}</p>
      </div>

      <div className="mb-8 p-6 border border-gray-200 rounded-lg shadow-sm bg-white">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Document Upload</h2>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <input 
              id="file-upload"
              type="file" 
              onChange={handleFileChange} 
              className="border p-2 rounded w-full max-w-sm"
              disabled={uploading}
            />
            <button 
              onClick={handleUpload} 
              disabled={!file || uploading}
              className={`font-semibold py-2 px-6 rounded min-w-[120px] transition-colors ${
                (!file || uploading) 
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
              }`}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
        </div>
      </div>

      <div className="p-6 border border-gray-200 rounded-lg shadow-sm bg-white">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Stored Documents</h2>
        {files.length === 0 ? (
          <p className="text-gray-500 italic">No documents found or Supabase not configured.</p>
        ) : (
          <ul className="list-disc pl-5 divide-y divide-gray-100">
            {files.map((f: {name: string, metadata?: { size?: number }}, i) => (
              <li key={i} className="py-4 flex flex-col group">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-gray-700 break-all">{f.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {f.metadata && f.metadata.size && (
                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded hidden sm:inline-block">
                        {Math.round(f.metadata.size / 1024)} KB
                      </span>
                    )}
                    <button
                      onClick={() => handleSummarize(f.name)}
                      disabled={summarizing[f.name]}
                      className="text-sm bg-purple-600 hover:bg-purple-700 text-white py-1 px-3 rounded shadow-sm disabled:bg-gray-400 transition-colors whitespace-nowrap"
                    >
                      {summarizing[f.name] ? 'Summarizing...' : 'Summarize'}
                    </button>
                  </div>
                </div>
                {summaries[f.name] && (
                  <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded text-sm text-gray-800 shadow-inner">
                    <strong className="block mb-1 text-indigo-700">AI Summary:</strong>
                    {summaries[f.name]}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
