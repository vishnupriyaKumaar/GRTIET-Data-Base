import React, { useState, useEffect, useRef } from "react";
import api from "../api";

// Search box that suggests students (by Name or Roll No) while typing.
// e.g. typing "Vishnu" lists Vishnu, VishnuPriya, Vishnu Kumar ...
// onPick(rollNo) is called when a suggestion is chosen.
export default function SuggestSearch({ value, onChange, onPick, placeholder, autoFocus }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 1) {
      setItems([]);
      return;
    }
    const token = ++tokenRef.current;
    const t = setTimeout(async () => {
      try {
        const res = await api.get("/students/search", { params: { q } });
        if (token !== tokenRef.current) return;
        setItems(res.data.data.slice(0, 8));
        setActive(-1);
      } catch (e) {
        if (token === tokenRef.current) setItems([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(item) {
    setOpen(false);
    onChange(item.rollNo);
    onPick(item.rollNo);
  }

  function onKeyDown(e) {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="suggest-wrap" ref={boxRef}>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {open && items.length > 0 && (
        <ul className="suggest-list">
          {items.map((it, i) => (
            <li
              key={it.rollNo}
              className={i === active ? "suggest-item active" : "suggest-item"}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(it);
              }}
            >
              <span className="suggest-name">{it.name}</span>
              <span className="suggest-meta">{it.rollNo} · {it.batch}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
