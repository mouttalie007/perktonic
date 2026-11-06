"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * Interactive component of every finished tool, by slug. Adding a delivered tool = drop its
 * folder in src/tools/<slug>/, add one line here and in slugs.ts, and flip its status to "live"
 * in src/config/tools.ts. Each tool is its own chunk (`dynamic` inside a client component):
 * a tool page downloads only its own code, and the component is still rendered on the server.
 */
const LOADERS: Record<string, ComponentType> = {
  "ai-document-action-item-extractor": dynamic(() => import("./ai-document-action-item-extractor/src/AiDocumentActionItemExtractorTool")),
  "ai-document-summarizer": dynamic(() => import("./ai-document-summarizer/src/AiDocumentSummarizerTool")),
  "ai-spreadsheet-formula-explainer": dynamic(() => import("./ai-spreadsheet-formula-explainer/src/AiSpreadsheetFormulaExplainerTool")),
  "broken-link-checker": dynamic(() => import("./broken-link-checker/src/BrokenLinkCheckerTool")),
  "bulk-url-status-code-checker": dynamic(() => import("./bulk-url-status-code-checker/src/BulkUrlStatusCodeCheckerTool")),
  "clean-messy-csv-data": dynamic(() => import("./clean-messy-csv-data/src/CleanMessyCsvDataTool")),
  "compare-two-csv-files": dynamic(() => import("./compare-two-csv-files/src/CompareTwoCsvFilesTool")),
  "conditional-formatting-formula-generator": dynamic(() => import("./conditional-formatting-formula-generator/src/ConditionalFormattingFormulaGeneratorTool")),
  "contract-key-terms-extractor": dynamic(() => import("./contract-key-terms-extractor/src/ContractKeyTermsExtractorTool")),
  "convert-excel-formula-to-google-sheets": dynamic(() => import("./convert-excel-formula-to-google-sheets/src/ConvertExcelFormulaToGoogleSheetsTool")),
  "convert-scanned-table-to-spreadsheet": dynamic(() => import("./convert-scanned-table-to-spreadsheet/src/ConvertScannedTableToSpreadsheetTool")),
  "cron-expression-generator": dynamic(() => import("./cron-expression-generator/src/CronExpressionGeneratorTool")),
  "cron-job-monitoring-heartbeat": dynamic(() => import("./cron-job-monitoring-heartbeat/src/CronJobMonitoringHeartbeatTool")),
  "csv-splitter-merger": dynamic(() => import("./csv-splitter-merger/src/CsvSplitterMergerTool")),
  "csv-to-json-converter": dynamic(() => import("./csv-to-json-converter/src/CsvToJsonConverterTool")),
  "csv-to-sql-insert-generator": dynamic(() => import("./csv-to-sql-insert-generator/src/CsvToSqlInsertGeneratorTool")),
  "csv-to-yaml-converter": dynamic(() => import("./csv-to-yaml-converter/src/CsvToYamlConverterTool")),
  "curl-to-python-converter": dynamic(() => import("./curl-to-python-converter/src/CurlToPythonConverterTool")),
  "dns-lookup-tool": dynamic(() => import("./dns-lookup-tool/src/DnsLookupToolTool")),
  "docx-to-markdown-converter": dynamic(() => import("./docx-to-markdown-converter/src/DocxToMarkdownConverterTool")),
  "excel-formula-debugger": dynamic(() => import("./excel-formula-debugger/src/ExcelFormulaDebuggerTool")),
  "excel-formula-generator": dynamic(() => import("./excel-formula-generator/src/ExcelFormulaGeneratorTool")),
  "excel-formula-to-sql-converter": dynamic(() => import("./excel-formula-to-sql-converter/src/ExcelFormulaToSqlConverterTool")),
  "excel-to-markdown-table-generator": dynamic(() => import("./excel-to-markdown-table-generator/src/ExcelToMarkdownTableGeneratorTool")),
  "excel-vba-macro-generator": dynamic(() => import("./excel-vba-macro-generator/src/ExcelVbaMacroGeneratorTool")),
  "google-apps-script-automation-generator": dynamic(() => import("./google-apps-script-automation-generator/src/GoogleAppsScriptAutomationGeneratorTool")),
  "google-sheets-query-builder": dynamic(() => import("./google-sheets-query-builder/src/GoogleSheetsQueryBuilderTool")),
  "http-response-header-analyzer": dynamic(() => import("./http-response-header-analyzer/src/HttpResponseHeaderAnalyzerTool")),
  "invoice-data-extractor": dynamic(() => import("./invoice-data-extractor/src/InvoiceDataExtractorTool")),
  "json-data-formatter-and-validator": dynamic(() => import("./json-data-formatter-and-validator/src/JsonDataFormatterAndValidatorTool")),
  "jsonpath-tester": dynamic(() => import("./jsonpath-tester/src/JsonpathTesterTool")),
  "meeting-minutes-generator-from-transcript": dynamic(() => import("./meeting-minutes-generator-from-transcript/src/MeetingMinutesGeneratorFromTranscriptTool")),
  "opengraph-and-meta-tag-validator": dynamic(() => import("./opengraph-and-meta-tag-validator/src/OpengraphAndMetaTagValidatorTool")),
  "pdf-to-csv-table-converter": dynamic(() => import("./pdf-to-csv-table-converter/src/PdfToCsvTableConverterTool")),
  "pdf-to-excel": dynamic(() => import("./pdf-to-excel/src/PdfToExcelTool")),
  "redirect-chain-checker": dynamic(() => import("./redirect-chain-checker/src/RedirectChainCheckerTool")),
  "regex-generator-tester": dynamic(() => import("./regex-generator-tester/src/RegexGeneratorTesterTool")),
  "remote-team-timezone-overlap-planner": dynamic(() => import("./remote-team-timezone-overlap-planner/src/RemoteTeamTimezoneOverlapPlannerTool")),
  "robots-txt-tester-and-sitemap-validator": dynamic(() => import("./robots-txt-tester-and-sitemap-validator/src/RobotsTxtTesterAndSitemapValidatorTool")),
  "sop-template-generator": dynamic(() => import("./sop-template-generator/src/SopTemplateGeneratorTool")),
  "spf-dkim-dmarc-checker": dynamic(() => import("./spf-dkim-dmarc-checker/src/SpfDkimDmarcCheckerTool")),
  "ssl-certificate-checker": dynamic(() => import("./ssl-certificate-checker/src/SslCertificateCheckerTool")),
  "standardize-phone-numbers-csv": dynamic(() => import("./standardize-phone-numbers-csv/src/StandardizePhoneNumbersCsvTool")),
  "text-data-parser-and-normalizer": dynamic(() => import("./text-data-parser-and-normalizer/src/TextDataParserAndNormalizerTool")),
  "text-to-mermaid-diagram-generator": dynamic(() => import("./text-to-mermaid-diagram-generator/src/TextToMermaidDiagramGeneratorTool")),
  "ttfb-server-response-time-test": dynamic(() => import("./ttfb-server-response-time-test/src/TtfbServerResponseTimeTestTool")),
  "webhook-json-payload-formatter": dynamic(() => import("./webhook-json-payload-formatter/src/WebhookJsonPayloadFormatterTool")),
  "webhook-test-url-generator": dynamic(() => import("./webhook-test-url-generator/src/WebhookTestUrlGeneratorTool")),
  "workflow-automation-roi-calculator": dynamic(() => import("./workflow-automation-roi-calculator/src/WorkflowAutomationRoiCalculatorTool")),
  "xlookup-vs-index-match-generator": dynamic(() => import("./xlookup-vs-index-match-generator/src/XlookupVsIndexMatchGeneratorTool")),
};

export const RUNNER_SLUGS = Object.keys(LOADERS);

export function ToolRunner({ slug }: { slug: string }) {
  const Tool = LOADERS[slug];
  return Tool ? <Tool /> : null;
}
