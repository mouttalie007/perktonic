/**
 * An invented customer export as it often arrives: names in capitals,
 * emails with spaces and "mailto:", phones in local and international
 * formats with extensions, countries in four languages, and European amounts.
 */
export const CONTACTS_CSV = `name,email,phone,country,balance
MCDONALD,  Ada.Lovelace@Example.COM ,07812 345678,UK,"1.234,56 €"
o'neil,mailto:grace.hopper@example.org,+44 20 7946 0958 ext. 204,United Kingdom,"€ 99,90"
jan van der berg,<alan@example.net>,020 794 6095,Pays-Bas,"2.500,00"
JEAN-LUC PICARD,jl.picard@example.fr,06 12 34 56 78,France,"-45,00 €"
DeShawn Jones,deshawn@example.com,(212) 555-0147,USA,"(12,50)"
fatima al-fihri,FATIMA@EXAMPLE.MA,0661 23 45 67,Maroc,"EUR 1.000,00"
hedy lamarr,hedy@example.at,+43 1 5131234,Österreich,"75,5"
maria da silva,maria@example.com.br,0044 7812 345679,Reino Unido,"3,00 €"
LINUS PAULING,linus@@example.com,12345,Allemagne,"$40,00"
ibn battuta,ibn.battuta@example,+212 5 22 12 34 56 x12,Marruecos,"1.020"
Katherine Johnson,katherine@example.com,0612345678,FRA,"8,75 EUR"
ALAN TURING,turing@example.co.uk,07700 900 123,Narnia,"12.345,6"
`;

/** The same kind of data with US-style amounts (1,234.56), for the decimal-format guess. */
export const US_AMOUNTS = ["$1,234.56", "$99.90", "2,500", "$0.75", "1,000,000.00", "(45.00)"];
