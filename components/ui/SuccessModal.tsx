"use client";

import React from "react";

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export default function SuccessModal({ isOpen, onClose, message = "Data berhasil disimpan!" }: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: 16,
          padding: "36px 32px 28px",
          maxWidth: 360,
          width: "90%",
          textAlign: "center",
          boxShadow: "0 20px 25px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
          {/* Outer glow */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              backgroundColor: "#dcfce7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {/* Inner circle */}
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                backgroundColor: "#4ade80",
                border: "4px solid #1a7a3a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Checkmark */}
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="white"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
          {/* Stars */}
          <svg width="24" height="24" viewBox="0 0 24 24" style={{ position: "absolute", top: 2, right: -4 }}>
            <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" fill="#f59e0b" />
          </svg>
          <svg width="20" height="20" viewBox="0 0 24 24" style={{ position: "absolute", bottom: 8, left: -8 }}>
            <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" fill="#f59e0b" />
          </svg>
          <svg width="14" height="14" viewBox="0 0 24 24" style={{ position: "absolute", top: 14, left: 0 }}>
            <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" fill="#fbbf24" />
          </svg>
        </div>

        {/* Message */}
        <p style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", margin: "0 0 24px" }}>
          {message}
        </p>

        {/* Button */}
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "12px 0",
            backgroundColor: "#4ade80",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Ya
        </button>
      </div>
    </div>
  );
}
