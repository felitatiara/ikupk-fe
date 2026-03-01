import React from 'react';

export default function InputTargetIKUPK({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-8 relative">
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          onClick={onClose}
        >
          &times;
        </button>
        <h2 className="text-xl font-bold mb-6">Pengajuan Target</h2>
        {/* ...form pengajuan target sesuai desain... */}
        <div className="mb-4">
          <label className="block font-semibold mb-1">Target</label>
          <span className="block mb-2">Indikator Kinerja Utama</span>
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-1">Indikator Kinerja Kegiatan</label>
          <span className="block mb-2">Indikator Kinerja Utama</span>
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-1">Sasaran Strategis</label>
          <span className="block mb-2">Meningkatnya kualitas lulusan pendidikan tinggi</span>
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-1">Target Universitas</label>
          <span className="block mb-2">75%</span>
        </div>
        {/* ...tambahkan form sesuai kebutuhan... */}
        <div className="flex justify-end mt-8">
          <button className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600">Ajukan</button>
        </div>
      </div>
    </div>
  );
}
