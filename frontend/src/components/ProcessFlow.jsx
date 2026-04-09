import React from 'react';
import { ChevronRight, Check, Circle } from 'lucide-react';

const ProcessFlow = ({ steps, currentStep = -1 }) => {
    return (
        <div className="process-flow" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {steps.map((step, index) => (
                    <React.Fragment key={index}>
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '15px', 
                            position: 'relative',
                            padding: '10px 0'
                        }}>
                            {/* Connector Line */}
                            {index < steps.length - 1 && (
                                <div style={{ 
                                    position: 'absolute', 
                                    left: '14px', 
                                    top: '40px', 
                                    width: '2px', 
                                    height: 'calc(100% - 20px)', 
                                    background: index < currentStep ? '#10b981' : '#e5e7eb',
                                    zIndex: 0
                                }}></div>
                            )}

                            {/* Circle Indicator */}
                            <div style={{ 
                                width: '30px', 
                                height: '30px', 
                                borderRadius: '50%', 
                                background: index < currentStep ? '#10b981' : (index === currentStep ? '#3b82f6' : '#fff'),
                                border: `2px solid ${index <= currentStep ? (index === currentStep ? '#3b82f6' : '#10b981') : '#e5e7eb'}`,
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                zIndex: 1,
                                color: index < currentStep ? '#fff' : (index === currentStep ? '#fff' : '#9ca3af'),
                                flexShrink: 0
                            }}>
                                {index < currentStep ? <Check size={16} strokeWidth={3} /> : (index === currentStep ? <div className="pulse-dot"></div> : <Circle size={12} fill="#e5e7eb" stroke="none" />)}
                            </div>

                            {/* Content */}
                            <div style={{ 
                                flex: 1, 
                                background: index === currentStep ? '#eff6ff' : 'transparent',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: index === currentStep ? '1px solid #bfdbfe' : '1px solid transparent',
                                transition: 'all 0.3s ease'
                            }}>
                                <h4 style={{ 
                                    margin: 0, 
                                    fontSize: '14px', 
                                    color: index <= currentStep ? '#1f2937' : '#9ca3af',
                                    fontWeight: index === currentStep ? '700' : '500'
                                }}>
                                    {step.title}
                                </h4>
                                {step.description && (
                                    <p style={{ 
                                        margin: '4px 0 0 0', 
                                        fontSize: '12px', 
                                        color: index <= currentStep ? '#6b7280' : '#d1d5db' 
                                    }}>
                                        {step.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    </React.Fragment>
                ))}
            </div>
            <style>{`
                .pulse-dot {
                    width: 10px;
                    height: 10px;
                    background-color: #fff;
                    border-radius: 50%;
                    animation: pulse 1.5s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
                    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(255, 255, 255, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
                }
            `}</style>
        </div>
    );
};

export default ProcessFlow;
