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
    const { period = "daily", startDate, endDate, page = 1, paymentMethod, status } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    const dateFilter = getDateRange(period, startDate, endDate);
    
    // Build query with optional filters
    let query = { ...dateFilter };
    
    if (paymentMethod && paymentMethod !== "all") {
      query.paymentMethod = paymentMethod;
    }
    
    if (status && status !== "all") {
      query.status = status;
    }

    // Fetch orders with pagination
    const orders = await Order.find(query)
      .populate("userId", "name email")
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    // Fetch all orders for statistics (without pagination)
    const allOrders = await Order.find(query)
      .populate("userId", "name email")
      .lean();

    const statistics = calculateStatistics(allOrders);

    res.render("salesreport", {
      title: "Sales Report",
      orders,
      statistics,
      currentPage: parseInt(page),
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
     res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};

// Download sales report
const downloadSalesReport = async (req, res) => {
  try {
    console.log("download Invocked")
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
      .sort({ createdOn: -1 })
      .lean();

    if (!orders || orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No orders found for the selected filters",
      });
    }

    const statistics = calculateStatistics(orders);

    if (format === "pdf") {
      await generatePDF(res, orders, statistics, period, startDate, endDate);
    } else if (format === "excel") {
      await generateExcel(res, orders, statistics, period, startDate, endDate);
    } else {
      return res.status(400).json({ success: false, message: "Invalid format" });
    }
  } catch (error) {
    console.error("Error downloading sales report:", error);
    res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};

// Generate PDF Report
const generatePDF = (res, orders, statistics, period, startDate, endDate) => {
  return new Promise((resolve, reject) => {
    try {
      console.log("PDF report Invocked")
      const filename = `sales-report-${period}-${new Date().toISOString().split("T")[0]}.pdf`;
      const doc = new PDFDocument({ margin: 40, size: "A4" });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
        resolve();
      });
      doc.on("error", reject);

      const colors = { primary: "#8b7355", light: "#f9f9f9", dark: "#2d2d2d", success: "#6b8e23" };

      // Header
      doc.fillColor(colors.primary).rect(40, 40, 515, 60).fill();
      doc.fillColor("#ffffff").fontSize(24).font("Helvetica-Bold").text("SALES REPORT", 60, 55);
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, 60, 85);

      let yPos = 120;

      // Summary Section
      doc.fillColor(colors.dark).fontSize(14).font("Helvetica-Bold").text("SUMMARY", 50, yPos);
      yPos += 25;

      const summaryData = [
        ["Total Orders", statistics.totalOrders.toString()],
        ["Total Revenue", `₹${statistics.totalRevenue.toFixed(2)}`],
        ["Average Order Value", `₹${statistics.averageOrderValue.toFixed(2)}`],
        ["Total Discounts", `₹${statistics.totalDiscount.toFixed(2)}`],
        ["Total Tax", `₹${statistics.totalTax.toFixed(2)}`],
        ["Total Shipping", `₹${statistics.totalShipping.toFixed(2)}`],
      ];

      doc.fontSize(10);
      summaryData.forEach((row) => {
        doc.fillColor(colors.dark).text(row[0], 50, yPos, { width: 200 });
        doc.text(row[1], 300, yPos, { align: "right" });
        yPos += 20;
      });

      yPos += 15;

      // Discount Breakdown
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
      }

      doc.fillColor(colors.dark).fontSize(12).font("Helvetica-Bold").text("DISCOUNT BREAKDOWN", 50, yPos);
      yPos += 20;

      const discountData = [
        ["Product Discounts", `₹${statistics.totalItemDiscount.toFixed(2)}`],
        ["Coupon Discounts", `₹${statistics.totalCouponDiscount.toFixed(2)}`],
        ["Total Discounts", `₹${statistics.totalDiscount.toFixed(2)}`],
      ];

      doc.fontSize(10);
      discountData.forEach((row) => {
        doc.fillColor(colors.dark).text(row[0], 50, yPos, { width: 200 });
        doc.text(row[1], 300, yPos, { align: "right" });
        yPos += 20;
      });

      yPos += 15;

      // Order Details Table
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
      }

      doc.fillColor(colors.dark).fontSize(12).font("Helvetica-Bold").text("ORDER DETAILS", 50, yPos);
      yPos += 20;

      // Table Headers
      doc.fillColor(colors.primary).rect(40, yPos, 515, 25).fill();
      doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");
      
      const headers = ["#", "Order ID", "Date", "Customer", "Amount", "Discount", "Tax", "Status"];
      const colWidths = [25, 70, 75, 100, 70, 70, 60, 65];
      let xPos = 50;

      headers.forEach((header, i) => {
        doc.text(header, xPos, yPos + 7, { width: colWidths[i], align: "center" });
        xPos += colWidths[i];
      });

      yPos += 30;

      // Table Rows
      orders.slice(0, 20).forEach((order, index) => {
        if (yPos > 720) {
          doc.addPage();
          yPos = 50;
        }

        if (index % 2 === 0) {
          doc.fillColor(colors.light).rect(40, yPos, 515, 20).fill();
        }

        doc.fillColor(colors.dark).fontSize(8).font("Helvetica");
        const discount = order.discount || 0;
        const rowData = [
          (index + 1).toString(),
          order.orderId || order._id.toString().slice(-8),
          new Date(order.createdOn).toLocaleDateString(),
          order.userId?.name || "N/A",
          `₹${(order.totalPrice || 0).toFixed(0)}`,
          `₹${discount.toFixed(0)}`,
          `₹${(order.tax || 0).toFixed(0)}`,
          order.status || "N/A",
        ];

        xPos = 50;
        rowData.forEach((data, i) => {
          doc.text(data, xPos, yPos + 5, { width: colWidths[i], align: "center" });
          xPos += colWidths[i];
        });

        yPos += 20;
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Generate Excel Report
const generateExcel = async (res, orders, statistics, period, startDate, endDate) => {
  try {
    console.log("generate Excel invocked")
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
      "Amount",
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
      const discount = order.discount || 0;
      worksheet.addRow([
        index + 1,
        order.orderId.toString(),
        new Date(order.createdOn).toLocaleDateString(),
        order.userId?.name || "N/A",
        order.userId?.email || "N/A",
        order.totalPrice || 0,
        order.itemDiscount || 0,
        order.discount || 0,
        discount,
        order.tax || 0,
        0,
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
     res.status(Status.INTERNAL_SERVER_ERROR).json({success:false,message:message.SERVER_ERROR});
  }
};

export {
  loadSalesReport,
  downloadSalesReport,
};