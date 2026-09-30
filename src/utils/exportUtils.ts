import { jsPDF } from 'jspdf';
import { Order, OrderItem } from '../types';

/**
 * Formats ISO date to readable Thai date and time
 */
export function formatThaiDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const months = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
    ];
    const year = d.getFullYear() + 543;
    const date = d.getDate();
    const month = months[d.getMonth()];
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${date} ${month} ${year} เวลา ${hours}:${minutes} น.`;
  } catch {
    return isoString;
  }
}

/**
 * Renders an order sheet into an HTML Canvas with dynamic calculated height
 * to ensure ZERO truncation, including all items, headers, and footers.
 */
export function renderOrderToCanvas(
  order: Order,
  options: {
    startItemIndex?: number;
    endItemIndex?: number;
    pageNumber?: number;
    totalPages?: number;
    isMultiPageMode?: boolean;
  } = {}
): HTMLCanvasElement {
  const isMultiPage = options.isMultiPageMode || false;
  const itemsToRender: OrderItem[] = isMultiPage
    ? order.items.slice(options.startItemIndex || 0, options.endItemIndex || order.items.length)
    : order.items;

  const width = 850;
  const paddingX = 40;
  const headerHeight = isMultiPage && (options.pageNumber || 1) > 1 ? 130 : 250;
  const rowHeight = 42;
  const tableHeaderHeight = 46;
  const tableHeight = tableHeaderHeight + itemsToRender.length * rowHeight;
  const isLastPage = !isMultiPage || (options.pageNumber === options.totalPages);
  const footerHeight = isLastPage ? 200 : 70;

  const totalHeight = headerHeight + tableHeight + footerHeight + 40;

  const canvas = document.createElement('canvas');
  // 2x Retina resolution for razor-sharp rendering
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = totalHeight * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get 2d canvas context');

  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, totalHeight);

  // Outer border & subtle shadow
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, width - 20, totalHeight - 20);

  // Top header color accent bar
  ctx.fillStyle = '#0F766E'; // Emerald primary
  ctx.fillRect(10, 10, width - 20, 8);

  let currentY = 35;

  // --- HEADER SECTION ---
  if (!isMultiPage || options.pageNumber === 1) {
    // Brand & Title
    ctx.fillStyle = '#D97706'; // Warm Amber Mango
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('Mango 🥭', paddingX, currentY + 10);

    ctx.fillStyle = '#64748B';
    ctx.font = '14px sans-serif';
    ctx.fillText('ระบบจัดการสินค้าและสั่งซื้อ', paddingX + 135, currentY + 7);

    // Title tag on right
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('ใบสั่งซื้อสินค้า / ORDER SHEET', width - paddingX, currentY + 10);
    ctx.textAlign = 'left';

    currentY += 45;

    // Divider
    ctx.strokeStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.moveTo(paddingX, currentY);
    ctx.lineTo(width - paddingX, currentY);
    ctx.stroke();

    currentY += 20;

    // Meta Grid Box
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(paddingX, currentY, width - paddingX * 2, 110);
    ctx.strokeStyle = '#E2E8F0';
    ctx.strokeRect(paddingX, currentY, width - paddingX * 2, 110);

    // Left Col: Order # & Market
    ctx.fillStyle = '#64748B';
    ctx.font = '13px sans-serif';
    ctx.fillText('เลขที่รายการ (Order No.):', paddingX + 20, currentY + 30);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(order.orderNumber, paddingX + 185, currentY + 30);

    ctx.fillStyle = '#64748B';
    ctx.font = '13px sans-serif';
    ctx.fillText('ตลาด (Market):', paddingX + 20, currentY + 65);
    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(order.marketName || '-', paddingX + 185, currentY + 65);

    ctx.fillStyle = '#64748B';
    ctx.font = '13px sans-serif';
    ctx.fillText('หมายเหตุ:', paddingX + 20, currentY + 95);
    ctx.fillStyle = '#475569';
    ctx.font = '14px sans-serif';
    ctx.fillText(order.note || 'ไม่มีหมายเหตุเพิ่มเติม', paddingX + 185, currentY + 95);

    // Right Col: Ordered By & Date/Time
    const rightColX = width / 2 + 30;
    ctx.fillStyle = '#64748B';
    ctx.font = '13px sans-serif';
    ctx.fillText('สั่งโดย (Ordered By):', rightColX, currentY + 30);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(order.userName || '-', rightColX + 140, currentY + 30);

    ctx.fillStyle = '#64748B';
    ctx.font = '13px sans-serif';
    ctx.fillText('วัน/เวลา (Date/Time):', rightColX, currentY + 65);
    ctx.fillStyle = '#334155';
    ctx.font = '14px sans-serif';
    ctx.fillText(formatThaiDateTime(order.createdAt), rightColX + 140, currentY + 65);

    ctx.fillStyle = '#64748B';
    ctx.font = '13px sans-serif';
    ctx.fillText('รายการทั้งหมด:', rightColX, currentY + 95);
    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${order.items.length} รายการ`, rightColX + 140, currentY + 95);

    currentY += 135;
  } else {
    // Continuation Page Header
    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('ใบสั่งซื้อสินค้า (ต่อ) - ' + order.orderNumber, paddingX, currentY + 10);

    ctx.fillStyle = '#64748B';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`ตลาด: ${order.marketName} | ผู้สั่ง: ${order.userName}`, width - paddingX, currentY + 10);
    ctx.textAlign = 'left';

    currentY += 35;
  }

  // --- TABLE SECTION ---
  // Table Columns
  // Col 1: # (50px)
  // Col 2: หมวดหมู่ (140px)
  // Col 3: ชื่อสินค้า (300px)
  // Col 4: คงเหลือ (Stock) (90px)
  // Col 5: สั่ง (Ordered) (90px)
  // Col 6: หน่วย (Unit) (100px)
  const cols = [
    { label: '#', width: 50, align: 'center' },
    { label: 'หมวดหมู่', width: 140, align: 'left' },
    { label: 'ชื่อสินค้า', width: 300, align: 'left' },
    { label: 'คงเหลือ', width: 90, align: 'right' },
    { label: 'สั่ง', width: 90, align: 'right' },
    { label: 'หน่วย', width: 100, align: 'left' },
  ];

  // Draw Table Header
  ctx.fillStyle = '#0F766E';
  ctx.fillRect(paddingX, currentY, width - paddingX * 2, tableHeaderHeight);

  let curColX = paddingX;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px sans-serif';

  cols.forEach((col) => {
    let textX = curColX + 10;
    if (col.align === 'right') textX = curColX + col.width - 15;
    if (col.align === 'center') textX = curColX + col.width / 2;

    ctx.textAlign = col.align as CanvasTextAlign;
    ctx.fillText(col.label, textX, currentY + 28);
    curColX += col.width;
  });

  currentY += tableHeaderHeight;

  // Draw Rows
  const startIndex = options.startItemIndex || 0;
  itemsToRender.forEach((item, index) => {
    const itemNumber = startIndex + index + 1;
    const isEven = index % 2 === 0;

    // Row Background
    ctx.fillStyle = isEven ? '#FFFFFF' : '#F8FAFC';
    ctx.fillRect(paddingX, currentY, width - paddingX * 2, rowHeight);

    // Row Bottom Border
    ctx.strokeStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(paddingX, currentY + rowHeight);
    ctx.lineTo(width - paddingX, currentY + rowHeight);
    ctx.stroke();

    curColX = paddingX;

    // 1. #
    ctx.fillStyle = '#64748B';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(itemNumber), curColX + cols[0].width / 2, currentY + 26);
    curColX += cols[0].width;

    // 2. หมวดหมู่
    ctx.fillStyle = '#475569';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.categoryName || 'ทั่วไป', curColX + 10, currentY + 26);
    curColX += cols[1].width;

    // 3. ชื่อสินค้า
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    // Truncate long name if necessary
    const displayName = item.itemName.length > 32 ? item.itemName.slice(0, 30) + '...' : item.itemName;
    ctx.fillText(displayName, curColX + 10, currentY + 26);
    curColX += cols[2].width;

    // 4. คงเหลือ (Stock)
    ctx.fillStyle = '#64748B';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(item.stockBefore ?? 0), curColX + cols[3].width - 15, currentY + 26);
    curColX += cols[3].width;

    // 5. สั่ง (Quantity) - Single number!
    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(item.quantity), curColX + cols[4].width - 15, currentY + 26);
    curColX += cols[4].width;

    // 6. หน่วย (Unit)
    ctx.fillStyle = '#334155';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.unit || 'ชิ้น', curColX + 15, currentY + 26);

    currentY += rowHeight;
  });

  // Table Outer Border
  ctx.strokeStyle = '#CBD5E1';
  ctx.strokeRect(paddingX, currentY - tableHeight, width - paddingX * 2, tableHeight);

  // --- FOOTER & SUMMARY SECTION ---
  currentY += 20;

  if (isLastPage) {
    // Summary Box
    const totalQty = order.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);

    ctx.fillStyle = '#F0FDFA';
    ctx.fillRect(paddingX, currentY, width - paddingX * 2, 50);
    ctx.strokeStyle = '#99F6E4';
    ctx.strokeRect(paddingX, currentY, width - paddingX * 2, 50);

    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`รวมทั้งหมด: ${order.items.length} รายการ`, paddingX + 20, currentY + 31);

    ctx.textAlign = 'right';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`ยอดสั่งรวมทั้งหมด: ${totalQty} ชิ้น/หน่วย`, width - paddingX - 20, currentY + 31);
    ctx.textAlign = 'left';

    currentY += 75;

    // Signature Area
    ctx.fillStyle = '#64748B';
    ctx.font = '13px sans-serif';

    const sigCol1 = paddingX + 40;
    const sigCol2 = width - paddingX - 260;

    ctx.fillText('ลงชื่อ ....................................................', sigCol1, currentY);
    ctx.fillText(`( ${order.userName || 'ผู้สั่งซื้อ'} )`, sigCol1 + 40, currentY + 25);
    ctx.fillText('ผู้สั่งสินค้า', sigCol1 + 75, currentY + 45);

    ctx.fillText('ลงชื่อ ....................................................', sigCol2, currentY);
    ctx.fillText('( .................................................... )', sigCol2 + 40, currentY + 25);
    ctx.fillText('ผู้ตรวจสอบ / ผู้จัดส่ง', sigCol2 + 65, currentY + 45);

    currentY += 70;
  }

  // Bottom watermark / branding
  ctx.fillStyle = '#94A3B8';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('เอกสารสร้างโดยระบบ Mango 🥭 Management • Google Sheets Database', paddingX, totalHeight - 22);

  if (options.pageNumber && options.totalPages) {
    ctx.textAlign = 'right';
    ctx.fillText(`หน้า ${options.pageNumber} จาก ${options.totalPages}`, width - paddingX, totalHeight - 22);
  }

  return canvas;
}

/**
 * Downloads high-resolution PNG image of the order.
 * Calculates dynamic height to NEVER cut off items or footers!
 */
export async function downloadOrderPng(order: Order): Promise<void> {
  // Render single continuous canvas containing all items
  const canvas = renderOrderToCanvas(order, { isMultiPageMode: false });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('เกิดข้อผิดพลาดในการสร้างไฟล์รูปภาพ PNG'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Mango-Order-${order.orderNumber}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png', 1.0);
  });
}

/**
 * Downloads multi-page PDF document of the order with automatic page splitting.
 * Guarantees zero cutoff and crisp Thai text rendering.
 */
export async function downloadOrderPdf(order: Order): Promise<void> {
  const itemsPerPageFirst = 18;
  const itemsPerPageSubsequent = 22;

  const totalItems = order.items.length;
  let totalPages = 1;

  if (totalItems > itemsPerPageFirst) {
    const remaining = totalItems - itemsPerPageFirst;
    totalPages = 1 + Math.ceil(remaining / itemsPerPageSubsequent);
  }

  // Create A4 PDF (Portrait: 210mm x 297mm)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let currentItemIndex = 0;

  for (let page = 1; page <= totalPages; page++) {
    const limit = page === 1 ? itemsPerPageFirst : itemsPerPageSubsequent;
    const nextIndex = Math.min(currentItemIndex + limit, totalItems);

    const pageCanvas = renderOrderToCanvas(order, {
      startItemIndex: currentItemIndex,
      endItemIndex: nextIndex,
      pageNumber: page,
      totalPages: totalPages,
      isMultiPageMode: true,
    });

    const imgData = pageCanvas.toDataURL('image/png', 1.0);

    if (page > 1) {
      pdf.addPage();
    }

    const pdfWidth = 210; // mm
    const pdfHeight = (pageCanvas.height / pageCanvas.width) * pdfWidth;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, 297));
    currentItemIndex = nextIndex;
  }

  pdf.save(`Mango-Order-${order.orderNumber}.pdf`);
}
