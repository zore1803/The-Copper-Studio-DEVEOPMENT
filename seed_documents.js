async function seed() {
  try {
    const res = await fetch("http://localhost:5000/api/crm/companies");
    if (!res.ok) throw new Error("Failed to fetch companies");
    const companies = await res.json();
    
    if (companies.length === 0) {
      console.log("No companies found to seed.");
      return;
    }
    
    const targetCompanies = companies.slice(0, 5);
    console.log(`Seeding documents for ${targetCompanies.length} companies...`);
    
    const fakeDocs = [
      { name: "Service Agreement.pdf", fileType: "pdf", fileSize: "1.2 MB", status: "approved" },
      { name: "Brand Guidelines.pdf", fileType: "pdf", fileSize: "4.5 MB", status: "final_delivery" },
      { name: "Logo Pack.zip", fileType: "zip", fileSize: "12.8 MB", status: "final_delivery" },
      { name: "Initial Proposal.pdf", fileType: "pdf", fileSize: "800 KB", status: "internal" },
      { name: "Meeting Notes.docx", fileType: "docx", fileSize: "250 KB", status: "pending_review" }
    ];

    let createdCount = 0;

    for (const company of targetCompanies) {
      console.log(`Adding docs for: ${company.companyName || company.name}`);
      
      for (const doc of fakeDocs) {
        const payload = {
          ...doc,
          companyId: company._id || company.id
        };
        
        try {
          const createRes = await fetch("http://localhost:5000/api/crm/documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          
          if (createRes.ok) {
            createdCount++;
          } else {
            console.error(`Failed to create doc for ${company.name}:`, await createRes.text());
          }
          await new Promise(r => setTimeout(r, 200));
        } catch (e) {
          console.error("Fetch error, ignoring:", e);
        }
      }
    }
    
    console.log(`Successfully created ${createdCount} fake documents!`);
    
  } catch (err) {
    console.error("Error seeding docs:", err);
  }
}

seed();
