import Foundation
import CoreGraphics
import ImageIO

let pdfPath = "/Users/artyom/Documents/Projets Code/Cartographie/Projet_Antigravity_Specifications.pdf"
let outputDir = "/Users/artyom/Documents/Projets Code/Cartographie/pdf_pages"

try FileManager.default.createDirectory(atPath: outputDir, withIntermediateDirectories: true)

guard let pdfURL = CFURLCreateFromFileSystemRepresentation(nil, pdfPath, pdfPath.utf8.count, false),
      let pdfDoc = CGPDFDocument(pdfURL) else {
    print("Failed to open PDF")
    exit(1)
}

let numPages = pdfDoc.numberOfPages
print("Number of pages: \(numPages)")

for pageNum in 1...numPages {
    guard let page = pdfDoc.page(at: pageNum) else { continue }
    
    let pageRect = page.getBoxRect(.mediaBox)
    let scale: CGFloat = 3.0
    let width = Int(pageRect.width * scale)
    let height = Int(pageRect.height * scale)
    
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { continue }
    
    context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    
    context.scaleBy(x: scale, y: scale)
    context.drawPDFPage(page)
    
    guard let image = context.makeImage() else { continue }
    
    let outputPath = "\(outputDir)/page_\(pageNum).png"
    guard let outputURL = CFURLCreateFromFileSystemRepresentation(nil, outputPath, outputPath.utf8.count, false),
          let dest = CGImageDestinationCreateWithURL(outputURL, "public.png" as CFString, 1, nil) else { continue }
    
    CGImageDestinationAddImage(dest, image, nil)
    CGImageDestinationFinalize(dest)
    print("Saved page \(pageNum)")
}
