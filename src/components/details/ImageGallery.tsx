import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { PlayCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import 'photoswipe/dist/photoswipe.css';
import { Gallery, Item } from 'react-photoswipe-gallery';

interface ImageGalleryProps {
  images: string[];
  title: string;
  videoUrl?: string;
}

interface ImageDimensions {
  width: number;
  height: number;
}

export default function ImageGallery({ images, title, videoUrl }: ImageGalleryProps) {
  const [showVideo, setShowVideo] = useState(false);
  const [currentMainImageIndex, setCurrentMainImageIndex] = useState(0);
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions[]>([]);
  const galleryRefs = useRef<(() => void)[]>([]);

  // Load image dimensions when images change
  useEffect(() => {
    const loadImageDimensions = async () => {
      const dimensions = await Promise.all(
        images.map((src) => {
          return new Promise<ImageDimensions>((resolve) => {
            const img = new Image();
            img.onload = () => {
              resolve({
                width: img.naturalWidth,
                height: img.naturalHeight,
              });
            };
            img.onerror = () => {
              // Fallback dimensions if image fails to load
              resolve({
                width: 1000,
                height: 1000,
              });
            };
            img.src = src;
          });
        })
      );
      setImageDimensions(dimensions);
    };

    if (images.length > 0) {
      loadImageDimensions();
    }
  }, [images]);

  // Handle main image click - open gallery at current index
  const handleMainImageClick = () => {
    if (galleryRefs.current[currentMainImageIndex]) {
      galleryRefs.current[currentMainImageIndex]();
    }
  };

  return (
    <>
      <div className="mb-8">
        <Gallery>
          <div className="grid grid-cols-12 gap-4">
            {/* Main featured image - NO Item wrapper to avoid duplication */}
            <div className="col-span-12 mb-4">
              <motion.div
                onClick={handleMainImageClick}
                className="cursor-pointer aspect-square overflow-hidden rounded-lg"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <img
                  src={images[currentMainImageIndex]}
                  alt={`${title} - Imagem principal`}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </motion.div>
            </div>

            {/* Thumbnail grid - these are the actual gallery items */}
            {images.map((image, index) => (
              <div key={index} className="col-span-3">
                {imageDimensions[index] && (
                  <Item
                    original={image}
                    thumbnail={image}
                    width={imageDimensions[index].width.toString()}
                    height={imageDimensions[index].height.toString()}
                  >
                    {({ ref, open }) => {
                      // Store the open function for this image
                      galleryRefs.current[index] = open;
                      
                      return (
                        <motion.div
                          ref={ref as any}
                          onClick={(e) => {
                            // Single click changes main image
                            e.stopPropagation();
                            setCurrentMainImageIndex(index);
                          }}
                          onDoubleClick={open} // Double click opens gallery
                          className={`cursor-pointer aspect-[4/3] overflow-hidden rounded-lg border-2 transition-all ${
                            currentMainImageIndex === index 
                              ? 'border-primary shadow-md' 
                              : 'border-transparent hover:border-primary/50'
                          }`}
                          whileHover={{ scale: 1.02 }}
                          transition={{ duration: 0.2 }}
                        >
                          <img
                            src={image}
                            alt={`${title} - Imagem ${index + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </motion.div>
                      );
                    }}
                  </Item>
                )}
              </div>
            ))}
            
            {/* Video thumbnail */}
            {videoUrl && (
              <div className="col-span-3">
                <div 
                  className="cursor-pointer aspect-[4/3] overflow-hidden rounded-lg relative group"
                  onClick={() => setShowVideo(true)}
                >
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center group-hover:bg-black/60 transition-colors">
                    <PlayCircle className="h-8 w-8 text-white opacity-80 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <img
                    src={images[0]}
                    alt="Video thumbnail"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>
        </Gallery>
      </div>

      {/* Video Modal */}
      {showVideo && videoUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 text-white hover:text-white/80"
              onClick={() => setShowVideo(false)}
            >
              <X className="h-6 w-6" />
            </Button>
            <iframe
              src={videoUrl}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </>
  );
}