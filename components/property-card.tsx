'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight, MapPin, Bed, Bath, Home, DollarSign, Eye } from 'lucide-react'
import { PropertyWithImages } from '@/lib/hooks/use-property-reviews'
import { cn } from '@/lib/utils'

interface PropertyCardProps {
  property: PropertyWithImages
  onClick: () => void
}

export function PropertyCard({ property, onClick }: PropertyCardProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true })
  const [currentIndex, setCurrentIndex] = useState(0)

  const scrollPrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    emblaApi?.scrollPrev()
  }

  const scrollNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    emblaApi?.scrollNext()
  }

  const pendingImagesCount = property.property_images.filter(
    img => img.admin_approved === null
  ).length

  const formatPrice = () => {
    const formatter = new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: property.currency || 'KES',
      minimumFractionDigits: 0,
    })
    return formatter.format(property.price)
  }

  return (
    <Card
      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onClick}
    >
      {/* Image Carousel */}
      <div className="relative overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {property.property_images.map((image, index) => (
            <div
              key={image.id}
              className="flex-[0_0_100%] min-w-0 relative aspect-[4/3]"
            >
              <Image
                src={image.thumbnail_url || image.image_url}
                alt={image.caption || property.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />

              {/* Image status badge */}
              <div className="absolute top-2 right-2">
                {image.admin_approved === null && (
                  <Badge variant="secondary" className="bg-yellow-500 text-white">
                    Pending
                  </Badge>
                )}
                {image.admin_approved === true && (
                  <Badge variant="secondary" className="bg-green-500 text-white">
                    Approved
                  </Badge>
                )}
                {image.admin_approved === false && (
                  <Badge variant="secondary" className="bg-red-500 text-white">
                    Rejected
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Carousel Navigation */}
        {property.property_images.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={scrollPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={scrollNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Image indicators */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1">
              {property.property_images.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all",
                    index === currentIndex
                      ? "bg-white w-4"
                      : "bg-white/50"
                  )}
                />
              ))}
            </div>
          </>
        )}

        {/* Pending images count badge */}
        {pendingImagesCount > 0 && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-primary text-primary-foreground">
              {pendingImagesCount} {pendingImagesCount === 1 ? 'image' : 'images'} pending
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-4">
        {/* Property Type & Deal Type */}
        <div className="flex items-center space-x-2 mb-2">
          <Badge variant="outline">{property.property_type}</Badge>
          <Badge variant="outline" className="capitalize">{property.deal_type}</Badge>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-lg mb-2 line-clamp-1">
          {property.title}
        </h3>

        {/* Location */}
        <div className="flex items-center text-sm text-muted-foreground mb-3">
          <MapPin className="h-4 w-4 mr-1" />
          <span className="line-clamp-1">{property.city}, {property.region}</span>
        </div>

        {/* Features */}
        <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-3">
          {property.bedrooms && (
            <div className="flex items-center">
              <Bed className="h-4 w-4 mr-1" />
              <span>{property.bedrooms}</span>
            </div>
          )}
          {property.bathrooms && (
            <div className="flex items-center">
              <Bath className="h-4 w-4 mr-1" />
              <span>{property.bathrooms}</span>
            </div>
          )}
          {property.square_meters && (
            <div className="flex items-center">
              <Home className="h-4 w-4 mr-1" />
              <span>{property.square_meters}m²</span>
            </div>
          )}
        </div>

        {/* Price */}
        <div className="flex items-center justify-between">
          <div className="flex items-center text-lg font-bold text-primary">
            <DollarSign className="h-5 w-5" />
            <span>{formatPrice()}</span>
            {property.price_period && (
              <span className="text-sm font-normal text-muted-foreground ml-1">
                / {property.price_period}
              </span>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
          >
            <Eye className="h-4 w-4 mr-1" />
            Review
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
