package com.housing.market.export;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.StringWriter;
import java.text.NumberFormat;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.stereotype.Service;

import com.housing.market.analysis.MarketStatsService;
import com.housing.market.analysis.MarketStatsService.MarketSummary;
import com.housing.market.analysis.PropertyFilter;
import com.housing.market.analysis.SegmentType;
import com.housing.market.data.Property;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;

/** CSV and PDF exports of the (filtered, sorted) market data. */
@Service
public class ExportService {

    private static final Color INK = new Color(0x1b, 0x22, 0x30);
    private static final Color MUTED = new Color(0x5a, 0x64, 0x76);
    private static final Color HEADER_BG = new Color(0xe6, 0xee, 0xfa);
    private static final Font TITLE = new Font(Font.HELVETICA, 18, Font.BOLD, INK);
    private static final Font H2 = new Font(Font.HELVETICA, 12, Font.BOLD, INK);
    private static final Font BODY = new Font(Font.HELVETICA, 9, Font.NORMAL, INK);
    private static final Font SMALL = new Font(Font.HELVETICA, 8, Font.NORMAL, MUTED);
    private static final Font TH = new Font(Font.HELVETICA, 8, Font.BOLD, INK);

    private final MarketStatsService stats;

    public ExportService(MarketStatsService stats) {
        this.stats = stats;
    }

    public byte[] csv(PropertyFilter filter, String sort, String dir) {
        List<String> features = stats.dataset().featureNames();
        List<String> header = new ArrayList<>();
        header.add("id");
        header.addAll(features);
        header.add("price");
        header.add("price_per_sqft");
        StringWriter out = new StringWriter();
        try (CSVPrinter printer = new CSVPrinter(out, CSVFormat.DEFAULT.builder()
                .setHeader(header.toArray(String[]::new)).get())) {
            for (Property p : stats.sorted(filter, sort, dir)) {
                List<Object> row = new ArrayList<>();
                row.add(p.id());
                features.forEach(f -> row.add(plain(p.feature(f))));
                row.add(plain(p.price()));
                row.add(p.pricePerSqft() == null ? "" : String.format(Locale.ROOT, "%.2f", p.pricePerSqft()));
                printer.printRecord(row);
            }
        } catch (IOException e) {
            throw new IllegalStateException("CSV export failed", e);
        }
        return out.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    public byte[] pdf(PropertyFilter filter, String sort, String dir) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4.rotate(), 36, 36, 36, 36);
        PdfWriter.getInstance(doc, out);
        doc.open();

        doc.add(new Paragraph("Property Market Report", TITLE));
        doc.add(new Paragraph("Filters: " + filter.describe() + "   ·   Generated "
                + ZonedDateTime.now().format(DateTimeFormatter.ofPattern("d MMM yyyy HH:mm z")), SMALL));
        doc.add(spacer());

        MarketSummary s = stats.summary(filter);
        doc.add(new Paragraph("Summary", H2));
        if (s.count() == 0) {
            doc.add(new Paragraph("No properties match these filters.", BODY));
            doc.close();
            return out.toByteArray();
        }
        PdfPTable kpis = table(new float[] {1, 1, 1, 1, 1});
        for (String h : List.of("Properties", "Median price", "Mean price", "Price range", "Median $/sq ft")) {
            kpis.addCell(th(h));
        }
        kpis.addCell(td(s.count() + " of " + s.totalProperties()));
        kpis.addCell(td(money(s.price().median())));
        kpis.addCell(td(money(s.price().mean())));
        kpis.addCell(td(money(s.price().min()) + " – " + money(s.price().max())));
        kpis.addCell(td(s.pricePerSqft() == null ? "–" : money(s.pricePerSqft().median())));
        doc.add(kpis);
        doc.add(spacer());

        if (stats.dataset().hasFeature(SegmentType.BEDROOMS.feature())) {
            doc.add(new Paragraph("By bedrooms", H2));
            PdfPTable seg = table(new float[] {2, 1, 2, 2, 2});
            for (String h : List.of("Segment", "Count", "Median price", "Mean price", "Median $/sq ft")) {
                seg.addCell(th(h));
            }
            for (var g : stats.segments(SegmentType.BEDROOMS, filter).segments()) {
                seg.addCell(td(g.label()));
                seg.addCell(tdRight(String.valueOf(g.count())));
                seg.addCell(tdRight(money(g.medianPrice())));
                seg.addCell(tdRight(money(g.meanPrice())));
                seg.addCell(tdRight(g.medianPricePerSqft() == null ? "–" : money(g.medianPricePerSqft())));
            }
            doc.add(seg);
            doc.add(spacer());
        }

        List<String> features = stats.dataset().featureNames();
        doc.add(new Paragraph("Properties (" + s.count() + ")", H2));
        float[] widths = new float[features.size() + 3];
        java.util.Arrays.fill(widths, 1);
        PdfPTable rows = table(widths);
        rows.setHeaderRows(1);
        rows.addCell(th("ID"));
        features.forEach(f -> rows.addCell(th(f.replace('_', ' '))));
        rows.addCell(th("Price"));
        rows.addCell(th("$/sq ft"));
        for (Property p : stats.sorted(filter, sort, dir)) {
            rows.addCell(tdRight(String.valueOf(p.id())));
            features.forEach(f -> rows.addCell(tdRight(plain(p.feature(f)))));
            rows.addCell(tdRight(money(p.price())));
            rows.addCell(tdRight(p.pricePerSqft() == null ? "–" : money(p.pricePerSqft())));
        }
        doc.add(rows);
        doc.close();
        return out.toByteArray();
    }

    private static PdfPTable table(float[] widths) {
        PdfPTable t = new PdfPTable(widths);
        t.setWidthPercentage(100);
        t.setSpacingBefore(6);
        return t;
    }

    private static PdfPCell th(String text) {
        PdfPCell c = new PdfPCell(new Phrase(text, TH));
        c.setBackgroundColor(HEADER_BG);
        c.setPadding(5);
        c.setBorderColor(new Color(0xdd, 0xe1, 0xe8));
        return c;
    }

    private static PdfPCell td(String text) {
        PdfPCell c = new PdfPCell(new Phrase(text, BODY));
        c.setPadding(5);
        c.setBorderColor(new Color(0xdd, 0xe1, 0xe8));
        return c;
    }

    private static PdfPCell tdRight(String text) {
        PdfPCell c = td(text);
        c.setHorizontalAlignment(Element.ALIGN_RIGHT);
        return c;
    }

    private static Paragraph spacer() {
        Paragraph p = new Paragraph(" ", SMALL);
        p.setSpacingAfter(4);
        return p;
    }

    private static String money(double v) {
        NumberFormat f = NumberFormat.getCurrencyInstance(Locale.US);
        f.setMaximumFractionDigits(0);
        return f.format(v);
    }

    private static String plain(Double v) {
        if (v == null) {
            return "";
        }
        return v == Math.rint(v) ? String.valueOf(v.longValue()) : String.valueOf(v);
    }
}
