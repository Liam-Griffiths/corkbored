"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Toolbar from "./Toolbar"

interface Note {
    id: string
    x: number
    y: number
    width: number
    height: number
    text: string
    isEditing: boolean
    type: 'text' | 'image'
    imageUrl?: string
}

const STORAGE_KEY = "corkbored-notes"
const MIN_NOTE_SIZE = 100
const BUTTON_SIZE = 20
const PADDING = 10

const CanvasBoard = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const textureRef = useRef<HTMLImageElement | null>(null)
    const [notes, setNotes] = useState<Note[]>([])
    const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
    const [editingText, setEditingText] = useState("")
    const [cursorPosition, setCursorPosition] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const [isTextureLoaded, setIsTextureLoaded] = useState(false)
    const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null)
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

    // Load texture and set initial canvas size
    useEffect(() => {
        const updateSize = () => {
            setCanvasSize({
                width: window.innerWidth,
                height: window.innerHeight,
            })
        }

        updateSize()
        window.addEventListener("resize", updateSize)

        // Load the texture image
        const texture = new Image()
        texture.src = "/cork.webp"
        texture.onload = () => {
            textureRef.current = texture
            setIsTextureLoaded(true)
        }

        return () => window.removeEventListener("resize", updateSize)
    }, [])

    // Load notes from localStorage
    useEffect(() => {
        const savedNotes = localStorage.getItem(STORAGE_KEY)
        if (savedNotes) {
            setNotes(JSON.parse(savedNotes))
        } else {
            // Create a welcome note in the middle of the canvas
            const welcomeNote: Note = {
                id: 'welcome',
                x: window.innerWidth / 2 - 150,
                y: window.innerHeight / 2 - 100,
                width: 300,
                height: 200,
                text: "Welcome to Corkbored!\n\nThis is a stupid placeholder website where you can add notes and images to a corkboard.\n\nDouble-click to edit text\nClick and drag to move notes\nHover over notes to resize or delete them",
                isEditing: false,
                type: 'text'
            }
            setNotes([welcomeNote])
            localStorage.setItem(STORAGE_KEY, JSON.stringify([welcomeNote]))
        }
    }, [])

    const wrapText = useCallback((ctx: CanvasRenderingContext2D, text: string | undefined, maxWidth: number) => {
        if (!text) return []
        const words = text.split(' ')
        const lines: string[] = []
        let currentLine = words[0]

        for (let i = 1; i < words.length; i++) {
            const word = words[i]
            const width = ctx.measureText(currentLine + ' ' + word).width
            if (width < maxWidth) {
                currentLine += ' ' + word
            } else {
                lines.push(currentLine)
                currentLine = word
            }
        }
        lines.push(currentLine)
        return lines
    }, [])

    const calculateNoteSize = (ctx: CanvasRenderingContext2D, text: string, currentWidth: number) => {
        const lines = wrapText(ctx, text, currentWidth - (PADDING * 2))
        const lineHeight = 20
        const minHeight = 60
        const minWidth = 160
        const textHeight = Math.max(minHeight, lines.length * lineHeight + 40)
        const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width))
        const textWidth = Math.max(minWidth, maxLineWidth + (PADDING * 2))
        
        return {
            width: textWidth,
            height: textHeight
        }
    }

    const drawCanvas = useCallback((ctx: CanvasRenderingContext2D) => {
        const canvas = canvasRef.current
        if (!canvas) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw the texture pattern
        if (textureRef.current) {
            const pattern = ctx.createPattern(textureRef.current, "repeat")
            if (pattern) {
                ctx.fillStyle = pattern
                ctx.fillRect(0, 0, canvas.width, canvas.height)
            }
        } else {
            ctx.fillStyle = "#f0f0f0"
            ctx.fillRect(0, 0, canvas.width, canvas.height)
        }

        // Draw the notes
        notes.forEach(note => {
            if (note.type === 'image' && note.imageUrl) {
                const img = new Image()
                img.src = note.imageUrl
                ctx.drawImage(img, note.x, note.y, note.width, note.height)
                ctx.strokeStyle = "#333"
                ctx.strokeRect(note.x, note.y, note.width, note.height)
            } else {
                // Draw note background
                ctx.fillStyle = note.id === selectedNoteId ? "#fff8b0" : "#fff8dc"
                ctx.fillRect(note.x, note.y, note.width, note.height)
                ctx.strokeStyle = "#333"
                ctx.strokeRect(note.x, note.y, note.width, note.height)
                
                ctx.fillStyle = "#000"
                ctx.font = "14px sans-serif"
                
                if (note.isEditing) {
                    // Split text at cursor position
                    const textBeforeCursor = editingText.slice(0, cursorPosition)
                    const textAfterCursor = editingText.slice(cursorPosition)
                    
                    // Get lines for text before cursor
                    const linesBeforeCursor = wrapText(ctx, textBeforeCursor, note.width - (PADDING * 2))
                    const lastLineBeforeCursor = linesBeforeCursor[linesBeforeCursor.length - 1]
                    
                    // Get lines for text after cursor
                    const linesAfterCursor = wrapText(ctx, textAfterCursor, note.width - (PADDING * 2))
                    const firstLineAfterCursor = linesAfterCursor[0]
                    
                    // Draw all lines before cursor
                    linesBeforeCursor.slice(0, -1).forEach((line, i) => {
                        ctx.fillText(line, note.x + PADDING, note.y + 30 + (i * 20))
                    })
                    
                    // Draw last line before cursor with cursor
                    const metrics = ctx.measureText(lastLineBeforeCursor)
                    ctx.fillText(lastLineBeforeCursor, note.x + PADDING, note.y + 30 + ((linesBeforeCursor.length - 1) * 20))
                    ctx.fillStyle = "#000"
                    ctx.fillRect(
                        note.x + PADDING + metrics.width,
                        note.y + 20 + ((linesBeforeCursor.length - 1) * 20),
                        2,
                        20
                    )
                    
                    // Draw first line after cursor
                    if (firstLineAfterCursor) {
                        ctx.fillText(
                            firstLineAfterCursor,
                            note.x + PADDING + (lastLineBeforeCursor ? metrics.width : 0),
                            note.y + 30 + ((linesBeforeCursor.length - 1) * 20)
                        )
                    }
                    
                    // Draw remaining lines after cursor
                    linesAfterCursor.slice(1).forEach((line, i) => {
                        ctx.fillText(
                            line,
                            note.x + PADDING,
                            note.y + 30 + ((linesBeforeCursor.length + i) * 20)
                        )
                    })
                } else {
                    const lines = wrapText(ctx, note.text, note.width - (PADDING * 2))
                    lines.forEach((line, i) => {
                        ctx.fillText(line, note.x + PADDING, note.y + 30 + (i * 20))
                    })
                }
            }
        })
    }, [notes, editingText, cursorPosition, selectedNoteId, wrapText])

    // Draw canvas whenever relevant state changes
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        drawCanvas(ctx)
    }, [notes, cursorPosition, editingText, isTextureLoaded, canvasSize, hoveredNoteId, selectedNoteId, drawCanvas])

    const handleMouseDown = (e: React.MouseEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return

        canvas.focus()
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        // Check for note click
        const clickedNote = notes.find(note => 
            x > note.x && x < note.x + note.width && 
            y > note.y && y < note.y + note.height
        )

        if (clickedNote) {
            if (e.detail === 2) { // Double click
                setNotes(prev => prev.map(note => 
                    note.id === clickedNote.id 
                        ? { ...note, isEditing: true }
                        : { ...note, isEditing: false }
                ))
                setEditingText(clickedNote.text)
                setCursorPosition(clickedNote.text.length)
                setSelectedNoteId(clickedNote.id)
            } else {
                setIsDragging(true)
                setDraggedNoteId(clickedNote.id)
                setOffset({ x: x - clickedNote.x, y: y - clickedNote.y })
                setSelectedNoteId(clickedNote.id)
            }
        } else {
            setNotes(prev => prev.map(note => ({ ...note, isEditing: false })))
            setSelectedNoteId(null)
        }
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!draggedNoteId) return

        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        if (isResizing) {
            setNotes(prev =>
                prev.map(note =>
                    note.id === draggedNoteId
                        ? {
                            ...note,
                            width: Math.max(MIN_NOTE_SIZE, x - note.x),
                            height: Math.max(MIN_NOTE_SIZE, y - note.y)
                        }
                        : note
                )
            )
        } else if (isDragging) {
            setNotes(prev =>
                prev.map(note =>
                    note.id === draggedNoteId
                        ? { ...note, x: x - offset.x, y: y - offset.y }
                        : note
                )
            )
        }

        // Update hover state
        const hovered = notes.find(note => 
            x > note.x && x < note.x + note.width && 
            y > note.y && y < note.y + note.height
        )
        setHoveredNoteId(hovered?.id || null)
    }

    const handleMouseUp = () => {
        setIsDragging(false)
        setIsResizing(false)
        setDraggedNoteId(null)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const editingNote = notes.find(note => note.isEditing)
        if (editingNote) {
            const canvas = canvasRef.current
            if (!canvas) return
            const ctx = canvas.getContext("2d")
            if (!ctx) return

            if (e.key === 'Escape') {
                setNotes(prev => prev.map(note => 
                    note.id === editingNote.id 
                        ? { ...note, isEditing: false }
                        : note
                ))
            } else if (e.key === 'Backspace') {
                e.preventDefault()
                const newText = editingText.slice(0, cursorPosition - 1) + editingText.slice(cursorPosition)
                setEditingText(newText)
                setCursorPosition(Math.max(0, cursorPosition - 1))
                const newSize = calculateNoteSize(ctx, newText, editingNote.width)
                setNotes(prev => prev.map(note => 
                    note.id === editingNote.id 
                        ? { ...note, text: newText, width: newSize.width, height: newSize.height }
                        : note
                ))
                localStorage.setItem(STORAGE_KEY, JSON.stringify(notes.map(note => 
                    note.id === editingNote.id 
                        ? { ...note, text: newText, width: newSize.width, height: newSize.height }
                        : note
                )))
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault()
                setCursorPosition(Math.max(0, cursorPosition - 1))
            } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                setCursorPosition(Math.min(editingText.length, cursorPosition + 1))
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                // Move cursor to end of previous line
                const lines = wrapText(ctx, editingText, editingNote.width - (PADDING * 2))
                const currentLineIndex = lines.findIndex((line, i) => {
                    const lineStart = lines.slice(0, i).join(' ').length
                    const lineEnd = lineStart + line.length
                    return cursorPosition >= lineStart && cursorPosition <= lineEnd
                })
                if (currentLineIndex > 0) {
                    const prevLine = lines[currentLineIndex - 1]
                    const newPosition = lines.slice(0, currentLineIndex - 1).join(' ').length + prevLine.length
                    setCursorPosition(newPosition)
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                // Move cursor to start of next line
                const lines = wrapText(ctx, editingText, editingNote.width - (PADDING * 2))
                const currentLineIndex = lines.findIndex((line, i) => {
                    const lineStart = lines.slice(0, i).join(' ').length
                    const lineEnd = lineStart + line.length
                    return cursorPosition >= lineStart && cursorPosition <= lineEnd
                })
                if (currentLineIndex < lines.length - 1) {
                    const newPosition = lines.slice(0, currentLineIndex + 1).join(' ').length
                    setCursorPosition(newPosition)
                }
            } else if (e.key.length === 1) {
                e.preventDefault()
                const newText = editingText.slice(0, cursorPosition) + e.key + editingText.slice(cursorPosition)
                setEditingText(newText)
                setCursorPosition(cursorPosition + 1)
                const newSize = calculateNoteSize(ctx, newText, editingNote.width)
                setNotes(prev => prev.map(note => 
                    note.id === editingNote.id 
                        ? { ...note, text: newText, width: newSize.width, height: newSize.height }
                        : note
                ))
                localStorage.setItem(STORAGE_KEY, JSON.stringify(notes.map(note => 
                    note.id === editingNote.id 
                        ? { ...note, text: newText, width: newSize.width, height: newSize.height }
                        : note
                )))
            }
        }
    }

    const addNote = () => {
        const newNote: Note = {
            id: Date.now().toString(),
            x: 100,
            y: 100,
            width: 160,
            height: 60,
            text: "New note",
            isEditing: true,
            type: 'text'
        }
        setEditingText("New note")
        setCursorPosition("New note".length)
        const newNotes = [...notes, newNote]
        setNotes(newNotes)
        setSelectedNoteId(newNote.id)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newNotes))
    }

    const handleDeleteNote = (noteId: string) => {
        setNotes(prev => prev.filter(note => note.id !== noteId))
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes.filter(note => note.id !== noteId)))
    }

    const handleResizeStart = (noteId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setIsResizing(true)
        setDraggedNoteId(noteId)
        const note = notes.find(n => n.id === noteId)
        if (note) {
            const rect = canvasRef.current?.getBoundingClientRect()
            if (rect) {
                setOffset({ 
                    x: e.clientX - rect.left - note.width, 
                    y: e.clientY - rect.top - note.height 
                })
            }
        }
    }

    const handleAddImage = (url: string) => {
        const newNote: Note = {
            id: Date.now().toString(),
            x: 100,
            y: 100,
            width: 200,
            height: 200,
            text: "",
            isEditing: false,
            type: 'image',
            imageUrl: url
        }
        setNotes(prev => [...prev, newNote])
        setSelectedNoteId(newNote.id)
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...notes, newNote]))
    }

    const handleDeleteAll = () => {
        if (window.confirm("Are you sure you want to delete everything? This cannot be undone!")) {
            setNotes([])
            localStorage.removeItem(STORAGE_KEY)
        }
    }

    return (
        <div className="relative w-full h-screen overflow-hidden">
            <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                className="fixed top-0 left-64 w-[calc(100%-16rem)] h-screen z-0 bg-[#f0f0f0] outline-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onKeyDown={handleKeyDown}
                tabIndex={0}
            />
            <Toolbar 
                onAddNote={addNote} 
                onAddImage={handleAddImage} 
                onDeleteAll={handleDeleteAll}
            />
            <div className="fixed top-0 left-64 w-[calc(100%-16rem)] h-screen pointer-events-none">
                {notes.map(note => (
                    (note.id === hoveredNoteId || note.id === selectedNoteId) && (
                        <div
                            key={note.id}
                            className="absolute pointer-events-none"
                            style={{
                                left: note.x,
                                top: note.y,
                                width: note.width,
                                height: note.height,
                            }}
                        >
                            <button
                                className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white rounded-sm pointer-events-auto"
                                onClick={() => handleDeleteNote(note.id)}
                            >
                                ×
                            </button>
                            <button
                                className="absolute bottom-0 right-0 w-5 h-5 bg-gray-700 text-white rounded-sm pointer-events-auto"
                                onMouseDown={(e) => handleResizeStart(note.id, e)}
                            >
                                ↘
                            </button>
                        </div>
                    )
                ))}
            </div>
        </div>
    )
}

export default CanvasBoard
