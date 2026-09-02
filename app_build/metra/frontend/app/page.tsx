"use client";
import { useState } from "react";

export default function Home() {
  const [message, setMessage] = useState("");

  const checkBackend = async () => {
    const res = await fetch("http://localhost:8000/health");
    const data = await res.json();
    setMessage(data.message);
  };

  return (
    <main style={{ padding: 40 }}>
      <h1>METRA</h1>
      <button onClick={checkBackend}>Ping Backend</button>
      <p>{message}</p>
    </main>
  );
}