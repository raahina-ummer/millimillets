import Order from "../../models/OrderSchema.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { calculateStatistics, getDateRange } from "../../Helpers/salesCalculation.js";
import Status from "../../utils/status.js";
import message from "../../utils/message.js";
import logger from '../../utils/logger.js';

// Load sales report page
const loadSalesReport = async (req, res) => {
  try {
    const {
      period = "daily",
      startDate,
      endDate,
      page = 1,
      paymentMethod,
      status
    } = req.query;

    const limit = 10;
    const currentPage = parseInt(page) || 1;
    const skip = (currentPage - 1) * limit;


    if (period === "custom") {

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: "Start and End date required"
        });
      }

      const todayStr = new Date().toLocaleDateString("en-CA");
      // en-CA gives YYYY-MM-DD in LOCAL timezone

      // Safe string comparison
      if (startDate > todayStr || endDate > todayStr) {
        return res.status(400).json({
          success: false,
          message: "Future dates not allowed"
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({
          success: false,
          message: "Start date cannot be after End date"
        });
      }
    }


    const dateFilter = getDateRange(period, startDate, endDate);

    // Build query with optional filters
    let query = { ...dateFilter };

    if (paymentMethod && paymentMethod !== "all") {
      query.paymentMethod = paymentMethod;
    }

    if (status && status !== "all") {
      query.status = status;
    }


    const [orders, totalOrders, allOrders] = await Promise.all([

      Order.find(query)
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Order.countDocuments(query),

      Order.find(query)
        .populate("userId", "name email")
        .lean()

    ]);

    const totalPages = Math.ceil(totalOrders / limit);

    const statistics = calculateStatistics(allOrders);

    res.render("salesreport", {
      title: "Sales Report",
      currentRoute: "sales-report",
      orders,
      statistics,
      currentPage,
      totalPages,
      totalOrders,
      period,
      startDate: startDate || "",
      endDate: endDate || "",
      paymentMethod: paymentMethod || "all",
      status: status || "all",
    });

  } catch (error) {
    console.error("Error generating sales report:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};


// Download sales report
const downloadSalesReport = async (req, res) => {
  try {
    const { format, period = "daily", startDate, endDate, paymentMethod, status } = req.query;

    const dateFilter = getDateRange(period, startDate, endDate);

    let query = { ...dateFilter };

    if (paymentMethod && paymentMethod !== "all") {
      query.paymentMethod = paymentMethod;
    }

    if (status && status !== "all") {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    if (!orders || orders.length === 0) {
      return res.status(Status.BAD_REQUEST).json({
        success: false,
        message: message.ORDER.NOT_FOUND,
      });
    }

    const statistics = calculateStatistics(orders);

    if (format === "pdf") {
      await generatePDF(res, orders, statistics, period, startDate, endDate);
    } else if (format === "excel") {
      await generateExcel(res, orders, statistics, period, startDate, endDate);
    } else {
      return res.status(Status.BAD_REQUEST).json({ success: false, message: "Invalid format" });
    }
  } catch (error) {
    console.error("Error downloading sales report:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

// Generate PDF Report
const generatePDF = (res, orders, statistics, period, startDate, endDate) => {
  return new Promise((resolve, reject) => {
    try {
      const filename = `sales-report-${period}-${new Date().toISOString().split("T")[0]}.pdf`;
      const doc = new PDFDocument({ margin: 40, size: "A4" });

      const chunks = [];
      doc.on("data", c => chunks.push(c));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
        resolve();
      });
      doc.on("error", reject);

      /* ---------------- HEADER ---------------- */

      doc.rect(40, 40, 515, 55).fill("#222");
      doc.fillColor("#fff")
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("SALES REPORT", 55, 55);

      doc.fontSize(10)
        .font("Helvetica")
        .text(`Generated: ${new Date().toLocaleString()}`, 55, 78);

      let y = 115;

      /* ---------------- SUMMARY ---------------- */

      doc.fillColor("#000").fontSize(13).font("Helvetica-Bold").text("SUMMARY", 50, y);
      y += 20;

      const summary = [
        ["Total Orders", statistics.totalOrders],
        ["Revenue", `Rs ${statistics.totalRevenue.toFixed(2)}`],
        ["Avg Order Value", `Rs ${statistics.averageOrderValue.toFixed(2)}`],
        ["Total Discount", `Rs ${statistics.totalDiscount.toFixed(2)}`],
        ["Tax", `Rs ${statistics.totalTax.toFixed(2)}`],
        ["Shipping", `Rs ${statistics.totalShipping.toFixed(2)}`],
        ["Refunded", `Rs ${statistics.refundedAmount.toFixed(2)}`],
      ];

      doc.font("Helvetica").fontSize(10);

      summary.forEach(([k, v]) => {
        doc.text(k, 55, y);
        doc.text(String(v), 350, y, { width: 150, align: "right" });
        y += 16;
      });

      y += 20;

      /* ---------------- TABLE HEADER DRAWER ---------------- */

      const drawTableHeader = () => {
        doc.rect(40, y, 515, 22).fill("#444");
        doc.fillColor("#fff").fontSize(9).font("Helvetica-Bold");

        headers.forEach((h, i) => {
          doc.text(h, colX[i], y + 6, {
            width: colW[i],
            align: "center",
            lineBreak: false
          });
        });

        y += 26;
      };

      /* ---------------- TABLE CONFIG ---------------- */

      const headers = ["#", "Order ID", "Date", "Customer", "Final", "Discount", "Tax", "Status"];

      const colW = [30, 110, 70, 110, 60, 55, 40, 40]; // ✅ fits page

      const colX = [];
      let x = 45;
      colW.forEach(w => {
        colX.push(x);
        x += w;
      });


      doc.fillColor("#000").fontSize(12).font("Helvetica-Bold").text("ORDER DETAILS", 50, y);
      y += 18;

      drawTableHeader();

      /* ---------------- TABLE ROWS ---------------- */

      orders.forEach((o, i) => {
        if (y > 750) {
          doc.addPage();
          y = 50;
          drawTableHeader();
        }

        if (i % 2 === 0) {
          doc.rect(40, y - 3, 515, 20).fill("#f2f2f2");
        }

        doc.fillColor("#000").font("Helvetica").fontSize(9);

        const discount = (o.couponDiscount || 0) + (o.itemDiscount || 0);

        const row = [
          i + 1,
          (o.orderId || "").slice(-12),
          new Date(o.createdAt).toLocaleDateString(),
          o.userId?.name || "N/A",
          `Rs ${(o.finalAmount || 0).toFixed(0)}`,
          `Rs ${discount.toFixed(0)}`,
          `Rs ${(o.tax || 0).toFixed(0)}`,
          o.status || "N/A"
        ];

        row.forEach((cell, c) => {
          doc.text(String(cell), colX[c], y, {
            width: colW[c],
            align: "center",
            lineBreak: false
          });
        });

        y += 20;
      });

      doc.end();

    } catch (err) {
      reject(err);
    }
  });
};

// Generate Excel Report
const generateExcel = async (res, orders, statistics, period, startDate, endDate) => {
  try {
    const filename = `sales-report-${period}-${new Date().toISOString().split("T")[0]}.xlsx`;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    // Title and metadata
    worksheet.addRow(["SALES REPORT"]);
    worksheet.addRow([`Period: ${period.toUpperCase()}`]);
    if (period === "custom") {
      worksheet.addRow([`Date Range: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`]);
    }
    worksheet.addRow([`Generated: ${new Date().toLocaleString()}`]);
    worksheet.addRow([]);

    // Summary Statistics
    worksheet.addRow(["SUMMARY STATISTICS"]);
    worksheet.addRow(["Metric", "Value"]);
    const summaryRows = [
      ["Total Orders", statistics.totalOrders],
      ["Total Order Amount", statistics.totalOrderAmount],
      ["Product Discounts", statistics.totalItemDiscount],
      ["Coupon Discounts", statistics.totalCouponDiscount],
      ["Total Discounts", statistics.totalDiscount],
      ["Tax Collected", statistics.totalTax],
      ["Shipping Charges", statistics.totalShipping],
      ["Net Revenue", statistics.totalRevenue],
      ["Average Order Value", statistics.averageOrderValue],
      ["Delivered Orders", statistics.deliveredOrders],
      ["Cancelled Orders", statistics.cancelledOrders],
      ["Returned Orders", statistics.returnedOrders],
    ];

    summaryRows.forEach((row) => worksheet.addRow(row));
    worksheet.addRow([]);

    // Order Details
    worksheet.addRow(["ORDER DETAILS"]);
    const headerRow = worksheet.addRow([
      "S.No",
      "Order ID",
      "Date",
      "Customer",
      "Email",
      "Order Amount",
      "Item Discount",
      "Coupon Discount",
      "Total Discount",
      "Tax",
      "Shipping",
      "Final Amount",
      "Payment Method",
      "Status",
    ]);


    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8b7355" } };
    headerRow.font.color = { argb: "FFFFFFFF" };

    orders.forEach((order, index) => {
      const couponDiscount = order.couponDiscount || 0;
      const itemDiscount = order.itemDiscount || 0;
      const totalDiscount = couponDiscount + itemDiscount;

      worksheet.addRow([
        index + 1,
        order.orderId?.toString() || "N/A",
        new Date(order.createdAt).toLocaleDateString(),
        order.userId?.name || "N/A",
        order.userId?.email || "N/A",

        order.totalPrice || 0,
        itemDiscount,
        couponDiscount,
        totalDiscount,
        order.tax || 0,
        order.shippingCost || 0,
        order.finalAmount || 0,
        order.paymentMethod || "N/A",
        order.status || "N/A",
      ]);

    });

    // Auto-fit columns
    worksheet.columns.forEach((col) => {
      col.width = 15;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Error generating Excel:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({ success: false, message: message.GENERAL.SERVER_ERROR });
  }
};

export {
  loadSalesReport,
  downloadSalesReport,
};