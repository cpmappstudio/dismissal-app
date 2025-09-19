"use client"

import * as React from "react"
import './birthday-decoration.css' // Import birthday decoration animations

interface BirthdayDecorationProps {
    isViewer?: boolean
    intensity?: 'light' | 'normal' | 'heavy'
}

export const BirthdayDecoration = React.memo<BirthdayDecorationProps>(({ 
    isViewer = false, 
    intensity = 'normal' 
}) => {
    // Configure decoration density based on intensity
    const config = React.useMemo(() => {
        switch (intensity) {
            case 'light':
                return { balloons: 4, confetti: 8 };
            case 'heavy':
                return { balloons: 8, confetti: 16 };
            default:
                return { balloons: 4, confetti: 8 };
        }
    }, [intensity]);

    // Mode-specific class for positioning
    const modeClass = isViewer ? 'birthday-viewer' : 'birthday-default';

    return (
        <div className={`absolute inset-0 pointer-events-none overflow-hidden ${modeClass}`}>
            {/* Globos flotantes con animación personalizada */}
            {Array.from({ length: config.balloons }).map((_, index) => {
                const balloonBaseTop = isViewer ? 40 : 20;
                return (
                    <div
                        key={`balloon-${index}`}
                        className="absolute birthday-float birthday-balloon-container"
                        style={{
                            animationDelay: `${index * 0.4}s`,
                            animationDuration: `${2.5 + (index % 3) * 0.5}s`,
                            left: `${20 + (index * 12) % 84}%`,
                            top: `${balloonBaseTop + (index * 8) % 25}%`,
                            zIndex: 100
                        }}
                    >
                        {/* Globo con hilo */}
                        <div className="relative">
                            {/* Globo con gradiente y sombra */}
                            <div 
                                className="birthday-balloon rounded-full shadow-lg birthday-glow"
                                style={{
                                    background: [
                                        'radial-gradient(ellipse at 30% 30%, #ff8e8e, #ff6b6b)',
                                        'radial-gradient(ellipse at 30% 30%, #7fdbda, #4ecdc4)',
                                        'radial-gradient(ellipse at 30% 30%, #7cc7e0, #45b7d1)',
                                        'radial-gradient(ellipse at 30% 30%, #b8e6d1, #96ceb4)',
                                        'radial-gradient(ellipse at 30% 30%, #fed382, #feca57)',
                                        'radial-gradient(ellipse at 30% 30%, #ff9ff3, #e056fd)'
                                    ][index % 6],
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.2), inset -2px -2px 4px rgba(255,255,255,0.3)'
                                }}
                            />
                            {/* Hilo del globo con sutil animación */}
                            <div 
                                className="birthday-thread absolute top-full left-1/2 transform -translate-x-1/2 w-px bg-gray-500 birthday-float"
                                style={{ 
                                    animationDelay: `${index * 0.4 + 0.2}s`
                                }}
                            />
                            {/* Pequeño nudo en el hilo */}
                            <div 
                                className="absolute left-1/2 transform -translate-x-1/2 w-1 h-1 bg-gray-600 rounded-full"
                                style={{ 
                                    top: 'calc(100% + 20px)'
                                }}
                            />
                        </div>
                    </div>
                )
            })}

            {/* Confeti con animación de caída */}
            {Array.from({ length: config.confetti }).map((_, index) => {
                const confettiBaseTop = isViewer ? 
                    (index % 2 === 0 ? 10 + (index * 4) % 20 : 70 + (index * 3) % 20) :
                    (index % 2 === 0 ? 5 + (index * 4) % 30 : 65 + (index * 3) % 30);
                
                return (
                    <div
                        key={`confetti-${index}`}
                        className="absolute confetti-fall birthday-confetti-container"
                        style={{
                            animationDelay: `${index * 0.15}s`,
                            animationDuration: `${3 + (index % 4) * 0.5}s`,
                            left: `${20 + (index * 7) % 94}%`,
                            top: `${confettiBaseTop}%`,
                            zIndex: 99
                        }}
                    >
                        <div 
                            className="birthday-confetti transform"
                            style={{
                                background: [
                                    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', 
                                    '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd',
                                    '#ff7675', '#74b9ff', '#fd79a8', '#fdcb6e'
                                ][index % 12],
                                borderRadius: index % 4 === 0 ? '50%' : 
                                              index % 4 === 1 ? '2px' : 
                                              index % 4 === 2 ? '0' : '1px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                            }}
                        />
                    </div>
                )
            })}
        </div>
    )
})

BirthdayDecoration.displayName = 'BirthdayDecoration'