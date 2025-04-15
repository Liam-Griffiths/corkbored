"use client"

import { useState, useRef, useEffect } from "react"

interface ToolbarProps {
    onAddNote: () => void;
    onAddImage: (url: string) => void;
    onDeleteAll: () => void;
}

const AUDIO_URL = "https://dn720307.ca.archive.org/0/items/crash-bandicoot-1-theme/Crash%20Bandicoot%201%20Theme.mp3"

const Toolbar = ({ onAddNote, onAddImage, onDeleteAll }: ToolbarProps) => {
    const [imageUrl, setImageUrl] = useState("")
    const [isPlaying, setIsPlaying] = useState(false)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        audioRef.current = new Audio(AUDIO_URL)
        audioRef.current.loop = true
        
        return () => {
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current = null
            }
        }
    }, [])

    const handleAddImage = () => {
        if (imageUrl) {
            onAddImage(imageUrl)
            setImageUrl("")
        }
    }

    const toggleAudio = () => {
        if (!audioRef.current) return

        if (isPlaying) {
            audioRef.current.pause()
        } else {
            audioRef.current.play()
        }
        setIsPlaying(!isPlaying)
    }

    return (
        <div className="fixed left-0 top-0 h-screen w-64 bg-neutral-800 text-white p-4 pt-20 flex flex-col">
            <div className="space-y-4 flex-1">
                <h2 className="text-lg font-semibold mb-4">Tools</h2>
                <button
                    onClick={onAddNote}
                    className="w-full px-4 py-2 bg-yellow-400 text-neutral-900 rounded shadow hover:bg-yellow-500 transition-colors"
                >
                    Add Note
                </button>
                <div className="space-y-2">
                    <input
                        type="text"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="Image URL"
                        className="w-full px-3 py-2 bg-neutral-700 text-white rounded"
                    />
                    <button
                        onClick={handleAddImage}
                        className="w-full px-4 py-2 bg-blue-400 text-white rounded shadow hover:bg-blue-500 transition-colors"
                    >
                        Add Image
                    </button>
                </div>
            </div>
            <div className="mt-auto space-y-4 pb-4">
                <button
                    onClick={onDeleteAll}
                    className="w-full px-4 py-2 bg-red-500 text-white rounded shadow hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                >
                    <span className="text-xl">🗑️</span>
                    Delete Everything
                </button>
                <button
                    onClick={toggleAudio}
                    className="w-full px-4 py-2 bg-orange-400 text-white rounded shadow hover:bg-orange-500 transition-colors flex items-center justify-center gap-2"
                >
                    <span className="text-xl">{isPlaying ? "⏸" : "▶"}</span>
                    {isPlaying ? "Pause Music" : "Play Music"}
                </button>
            </div>
        </div>
    );
};

export default Toolbar; 