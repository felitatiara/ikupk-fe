
import React from 'react';

interface InputTargetIKUPKProps {
  apiBaseUrl?: string;
  onClose?: () => void;
}

export default function InputTargetIKUPK({ apiBaseUrl = 'http://localhost:3000', onClose }: InputTargetIKUPKProps) {
  // Layout mirroring TargetIKUPKAdmin
  return (
    <div className="flex min-h-screen bg-gray-50">
        <main className="p-8">
  

          <h2 className="text-xl font-bold mb-6">Pengajuan Target</h2>
          {/* Info section as flexible columns */}
          <section className="table__body">

          <div className="table-header">
        
            <div className="table-row"></div>
              <div className="table-cell font-bold">Indikator</div>
              <div className="table-cell font-bold">:</div>
              <div className="table-cell font-bold">Indikator Kinerja Kegiatan</div>
  
            </div>
          
          </section>
      </main>
      </div>
  );
} 
