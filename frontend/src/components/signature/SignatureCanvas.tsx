import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import SignaturePad from 'signature_pad';

export interface SignatureCanvasRef {
  clear: () => void;
  undo: () => void;
  isEmpty: () => boolean;
  toDataURL: (type?: string) => string;
  toBlob: () => Blob | null;
}

interface Props {
  penColor?: string;
  backgroundColor?: string;
}

export const SignatureCanvas = forwardRef<SignatureCanvasRef, Props>(
  ({ penColor = '#000000', backgroundColor = 'rgba(255,255,255,0)' }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const signaturePadRef = useRef<SignaturePad | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Ajuste de resolución táctil para pantallas móviles / Retina
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);

      signaturePadRef.current = new SignaturePad(canvas, {
        penColor,
        backgroundColor,
        minWidth: 0.8,
        maxWidth: 2.5,
        velocityFilterWeight: 0.7,
      });

      const handleResize = () => {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d')?.scale(ratio, ratio);
        signaturePadRef.current?.clear();
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [penColor, backgroundColor]);

    useImperativeHandle(ref, () => ({
      clear: () => signaturePadRef.current?.clear(),
      undo: () => {
        const data = signaturePadRef.current?.toData() || [];
        data.pop();
        signaturePadRef.current?.fromData(data);
      },
      isEmpty: () => signaturePadRef.current?.isEmpty() ?? true,
      toDataURL: (type = 'image/png') => signaturePadRef.current?.toDataURL(type) || '',
      toBlob: () => {
        const dataURL = signaturePadRef.current?.toDataURL('image/png') || '';
        const byteString = atob(dataURL.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        return new Blob([ab], { type: 'image/png' });
      },
    }));

    return (
      <div className="signature-container">
        <canvas
          ref={canvasRef}
          className="signature-canvas"
          style={{ touchAction: 'none' }}
        />
      </div>
    );
  }
);

SignatureCanvas.displayName = 'SignatureCanvas';
